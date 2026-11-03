import { render } from 'preact';
import { Game, STEP } from './sim/game';
import { DAY_SECONDS, ROOMS, RUN_DAYS, UNDERGROUND_PACE, mutatorForDay, utcDayNow } from './sim/content';
import type { Defcon, RunConfig } from './sim/types';
import { BunkerView } from './render/view';
import { App, type UiState } from './ui/App';
import { Title } from './ui/Title';
import { PhoneGate, isPhone, phoneOverride } from './ui/PhoneGate';
import { audio } from './audio/audio';
import { dailySeed, loadMeta, recordRun, runConfig } from './meta';
import { tokenGate } from './chain/config';
import { clearPass, equippedDrip, readPass, refresh, restore, savePass, type RunPass } from './chain/wallet';
import { fetchWeather, serverDay, serverFinish, serverStart } from './chain/server';
import { ServerProblem } from './ui/ServerProblem';
import { CALM_ART, blastArt, preload } from './ui/preload';
import { tutorialHolds, tutorialSeen } from './ui/Tutorial';
import './style.css';

const params = new URLSearchParams(location.search);
const meta = loadMeta();

// Audio needs a user gesture before it can start.
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => audio.unlock(), { capture: true });
// The CRT screen effect: on unless the player turned it off.
try {
  if (localStorage.getItem('bunkr.crt') === 'off') document.body.classList.add('no-crt');
} catch {
  /* ignore */
}
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
const restored = restore();
// Handy for checking sound from the console.
Object.assign(window, { audio });
function boot(): void {
  if (!playing) {
    render(<Title meta={meta} />, document.getElementById('ui')!);
    // The bunker radio plays on the title screen too (it starts on the first click or key).
    audio.setMusic('bunker');
  } else void startRun();
}
// Phones get HATCH's "play it on PC" screen until the real mobile version ships.
if (isPhone() && !phoneOverride()) render(<PhoneGate onAnyway={boot} />, document.getElementById('ui')!);
else boot();

/** Ticketed runs get their seed and official config from the results server. */
async function officialPass(pass: RunPass, defcon: Defcon): Promise<RunPass | null> {
  if (pass.seed != null && pass.config) return pass;
  try {
    const reply = await serverStart({ txHash: pass.txHash, secret: pass.secret, defcon, vault: runConfig(meta, defcon, false), loadout: pass.loadout, tier: pass.tier });
    const next = { ...pass, seed: reply.seed, config: reply.config };
    savePass(next);
    return next;
  } catch (err) {
    render(<ServerProblem message={(err as Error).message} />, document.getElementById('ui')!);
    return null;
  }
}

async function startRun(): Promise<void> {
  const daily = params.has('daily');
  const wanted = Number(params.get('defcon') ?? 5);
  const defcon = Math.max(meta.unlocked, Math.min(5, Number.isFinite(wanted) ? wanted : 5)) as Defcon;
  const seedParam = params.get('seed');
  let seed = daily ? dailySeed() : seedParam ? Number(seedParam) : undefined;
  // With the token layer on, a run needs a pass from spending a Ration Ticket. No pass: Tent Mode.
  // The tutorial is always a free practice run (Tent Mode when the token layer is on).
  const tutorial = !daily && (params.has('tutorial') || (meta.runs === 0 && !tutorialSeen()));
  let pass = tokenGate && !params.has('tutorial') ? readPass(daily) : null;
  if (daily && !pass && tokenGate) {
    location.search = '';
    return;
  }
  let cfg: Partial<RunConfig> = { ...runConfig(meta, defcon, daily), mutator: mutatorForDay(utcDayNow()) };
  if (pass) {
    pass = await officialPass(pass, defcon);
    if (!pass) return;
    seed = pass.seed;
    cfg = pass.config!;
  } else if (tokenGate) {
    cfg = { ...cfg, tent: true, weather: (await fetchWeather())?.kind ?? null };
  }
  const game = new Game(seed, cfg);
  if (pass?.tier === 4) document.body.classList.add('silo');
  const ui: UiState = { selected: null, buildAt: null, speed: 1, drawer: null, roomView: null, inspectBag: null, rewards: null, tutorial: tutorial ? 0 : null };

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
    onRaider() {
      game.smash();
    },
  });

  render(<App game={game} ui={ui} view={view} />, document.getElementById('ui')!);

  // Cosmetics are looks only: applied once the wallet has reconnected.
  void restored.then(() => {
    const drip = tokenGate ? equippedDrip() : {};
    view.setBunkerSkin(drip.bunker ?? null);
    document.body.classList.toggle('drip-goldhatch', drip.hatch === 'goldhatch');
    ui.nukeSkin = drip.nuke ?? null;
    view.setNukeSkin(ui.nukeSkin);
    // The drop scene's art is big: fetch it during prep so the blast is instant.
    void preload(CALM_ART);
    void preload(blastArt(ui.nukeSkin));
    game.touch();
  });

  // Ticketed runs get each underground day's seed from the results server just before
  // that day starts. The sim waits (without counting time) if one hasn't arrived yet.
  const fetching = new Set<number>();
  function wantDay(): number | null {
    const need = game.awaitingDay();
    if (need != null) return need;
    if (game.phase === 'drop') return 1;
    if (game.phase === 'underground' && game.day < RUN_DAYS && game.phaseTime % DAY_SECONDS > DAY_SECONDS - 2) return game.day + 1;
    return null;
  }
  function fetchDays(): void {
    const day = pass ? wantDay() : null;
    if (day == null || game.daySeeds.has(day) || fetching.has(day)) return;
    fetching.add(day);
    serverDay({ runId: pass!.runId, secret: pass!.secret, day })
      .then((r) => {
        game.daySeeds.set(r.day, r.seed);
        if (r.event) game.dayEvents.set(r.day, r.event);
      })
      .catch(() => new Promise((ok) => setTimeout(ok, 1000))) // too early or offline: try again shortly
      .finally(() => {
        fetching.delete(day);
        game.touch();
      });
  }

  // Fixed-step sim, decoupled from render rate.
  let acc = 0;
  let last = performance.now();
  function loop(now: number) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    // Underground days run slower than sim time; boss fights stay at full speed so they
    // don't drag. Timed minigames (audit, revive) always run at 1x, whatever the speed.
    const minigame = !!(game.audit || game.revive);
    const pace = game.phase === 'underground' && !game.raid && !minigame ? UNDERGROUND_PACE : 1;
    fetchDays();
    acc += dt * (minigame ? Math.min(ui.speed, 1) : ui.speed) * pace;
    // The tutorial holds the prep clock while HATCH is explaining.
    if (game.phase === 'prep' && tutorialHolds(ui.tutorial ?? null)) acc = 0;
    // Don't bank time while waiting for a day seed, or the sim would lurch forward after.
    if (game.awaitingDay() != null) {
      acc = 0;
      game.touch();
    }
    let steps = 0;
    while (acc >= STEP && steps < 40) {
      game.step();
      acc -= STEP;
      steps++;
    }
    // Bank the run exactly once when it ends.
    if (game.ending && !ui.rewards) {
      ui.rewards = recordRun(meta, game.ending);
      if (pass) {
        const p = pass;
        // The server replays the inputs to get the real result. Retry-able from the end screen.
        ui.verify = () => {
          ui.verdict = { state: 'pending' };
          game.touch();
          serverFinish({ runId: p.runId, secret: p.secret, ticks: game.tick, inputs: game.inputs })
            .then((reply) => {
              ui.verdict = { state: 'ok', reply };
              clearPass();
            })
            .catch((err) => (ui.verdict = { state: 'error', error: (err as Error).message }))
            .finally(() => {
              void refresh();
              game.touch();
            });
        };
        ui.verify();
      } else {
        clearPass();
      }
      game.touch();
    }
    view.frame(dt);
    audio.setMusic(game.phase === 'prep' ? 'prep' : game.phase === 'underground' ? (game.raid ? 'raid' : 'bunker') : 'off');
    audio.setStation(game.station() ?? 'hopium');
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
    } else if ((e.key === 'f' || e.key === 'F') && game.revive && !game.revive.done) {
      if (!e.repeat) {
        game.pressF();
        audio.play('fpress');
      }
      e.preventDefault();
    } else if (game.audit && !game.audit.done) {
      if (e.key === 'a' || e.key === 'ArrowLeft') game.answerAudit(true);
      if (e.key === 'd' || e.key === 'ArrowRight') game.answerAudit(false);
    }
  });

  // Handy for playtesting from the console.
  Object.assign(window, { game, Game, view, meta });
}
