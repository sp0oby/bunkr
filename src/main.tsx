import { render } from 'preact';
import { Game, STEP } from './sim/game';
import { ROOMS, UNDERGROUND_PACE } from './sim/content';
import type { Defcon } from './sim/types';
import { BunkerView } from './render/view';
import { App, type UiState } from './ui/App';
import { Title } from './ui/Title';
import { PhoneGate, isPhone, phoneOverride } from './ui/PhoneGate';
import { audio } from './audio/audio';
import { dailySeed, loadMeta, recordRun, runConfig } from './meta';
import { tokenGate } from './chain/config';
import { clearPass, readPass, restore } from './chain/wallet';
import './style.css';

const params = new URLSearchParams(location.search);
const meta = loadMeta();

// Audio needs a user gesture before it can start.
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => audio.unlock(), { capture: true });
// Every HUD button gets a click.
document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (b && !b.disabled && !b.classList.contains('hotspot')) audio.play('click');
}, { capture: true });
// Block browser-level zoom shortcuts so the game owns the viewport.
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && ['=', '+', '-', '0'].includes(e.key)) e.preventDefault();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') audio.toggleMute();
});

const playing = params.has('play') || params.has('daily') || params.has('seed');
void restore();
function boot(): void {
  if (!playing) render(<Title meta={meta} />, document.getElementById('ui')!);
  else startRun();
}
// Phones get HATCH's "play it on PC" screen until the real mobile version ships.
if (isPhone() && !phoneOverride()) render(<PhoneGate onAnyway={boot} />, document.getElementById('ui')!);
else boot();

function startRun(): void {
  const daily = params.has('daily');
  const wanted = Number(params.get('defcon') ?? 5);
  const defcon = Math.max(meta.unlocked, Math.min(5, Number.isFinite(wanted) ? wanted : 5)) as Defcon;
  const seedParam = params.get('seed');
  const seed = daily ? dailySeed() : seedParam ? Number(seedParam) : undefined;
  // With the token layer on, a run needs a pass from spending a Ration Ticket. No pass: Tent Mode.
  const pass = tokenGate ? readPass(daily) : null;
  const chainCfg = !tokenGate ? {} : pass
    ? { deedTier: pass.tier, loadout: pass.loadout, rocket: pass.tier >= 3 || undefined }
    : { tent: true };
  const cfg = { ...runConfig(meta, defcon, daily), ...chainCfg };
  if (cfg.rocket === undefined) delete cfg.rocket;
  if (daily && !pass && tokenGate) {
    location.search = '';
    return;
  }
  const game = new Game(seed, cfg);
  if (pass?.tier === 4) document.body.classList.add('silo');
  const ui: UiState = { selected: null, buildAt: null, speed: 1, drawer: null, roomView: null, inspectBag: null, rewards: null };

  function assign(dwellerId: number, roomId: number): boolean {
    const room = game.roomById(roomId)!;
    if (!ROOMS[room.type].stat) {
      game.post(`${ROOMS[room.type].name} doesn't take workers.`, 'info');
      audio.play('denied');
      return false;
    }
    if (!game.assign(dwellerId, roomId)) {
      game.post(`${ROOMS[room.type].name} is full.`, 'info');
      audio.play('denied');
      return false;
    }
    return true;
  }

  const view = new BunkerView(document.getElementById('world')!, game, {
    selected: () => ui.selected,
    onDweller(id) {
      ui.selected = ui.selected === id ? null : id;
      game.touch();
    },
    onDrop(dwellerId, roomId) {
      assign(dwellerId, roomId);
      ui.selected = null;
      game.touch();
    },
    onRoom(roomId) {
      // With a degen selected, clicking a room assigns them; otherwise pop the room out.
      if (ui.selected != null) {
        if (assign(ui.selected, roomId)) ui.selected = null;
      } else {
        ui.roomView = roomId;
      }
      game.touch();
    },
    onEmptyCell(floor, col) {
      ui.buildAt = { floor, col };
      game.touch();
    },
    onDig() {
      game.digFloor();
    },
  });

  render(<App game={game} ui={ui} view={view} />, document.getElementById('ui')!);

  // Fixed-step sim, decoupled from render rate.
  let acc = 0;
  let last = performance.now();
  function loop(now: number) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    // Underground days run at one real minute each; boss fights and the audit
    // stay at full speed so they don't drag.
    const pace = game.phase === 'underground' && !game.raid && !game.audit ? UNDERGROUND_PACE : 1;
    acc += dt * ui.speed * pace;
    let steps = 0;
    while (acc >= STEP && steps < 40) {
      game.step();
      acc -= STEP;
      steps++;
    }
    // Bank the run exactly once when it ends.
    if (game.ending && !ui.rewards) {
      ui.rewards = recordRun(meta, game.ending);
      clearPass();
      game.touch();
    }
    view.frame(dt);
    audio.setMusic(game.phase === 'prep' ? 'prep' : game.phase === 'underground' ? (game.raid ? 'raid' : 'bunker') : 'off');
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      ui.speed = ui.speed === 0 ? 1 : 0;
      game.touch();
      e.preventDefault();
    } else if (e.key === 'm' || e.key === 'M') {
      game.touch();
    } else if (e.key === 'Escape') {
      ui.selected = null;
      ui.buildAt = null;
      ui.drawer = null;
      ui.roomView = null;
      ui.inspectBag = null;
      game.touch();
    } else if (game.audit && !game.audit.done) {
      if (e.key === 'a' || e.key === 'ArrowLeft') game.answerAudit(true);
      if (e.key === 'd' || e.key === 'ArrowRight') game.answerAudit(false);
    }
  });

  // Handy for playtesting from the console.
  Object.assign(window, { game, Game, view, meta });
}
