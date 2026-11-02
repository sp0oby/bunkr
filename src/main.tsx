import { render } from 'preact';
import { Game, STEP } from './sim/game';
import { ROOMS } from './sim/content';
import { BunkerView } from './render/view';
import { App, type UiState } from './ui/App';
import './style.css';

const seedParam = new URLSearchParams(location.search).get('seed');
const game = new Game(seedParam ? Number(seedParam) : undefined);
const ui: UiState = { selected: null, buildAt: null, speed: 1, drawer: null, roomView: null };

function assign(dwellerId: number, roomId: number): boolean {
  const room = game.roomById(roomId)!;
  if (!ROOMS[room.type].stat) {
    game.post(`${ROOMS[room.type].name} doesn't take workers.`, 'info');
    return false;
  }
  if (!game.assign(dwellerId, roomId)) {
    game.post(`${ROOMS[room.type].name} is full.`, 'info');
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
  acc += dt * ui.speed;
  let steps = 0;
  while (acc >= STEP && steps < 40) {
    game.step();
    acc -= STEP;
    steps++;
  }
  view.frame(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    ui.speed = ui.speed === 0 ? 1 : 0;
    game.touch();
    e.preventDefault();
  } else if (e.key === 'Escape') {
    ui.selected = null;
    ui.buildAt = null;
    ui.drawer = null;
    ui.roomView = null;
    game.touch();
  }
});
// Block browser-level zoom shortcuts so the game owns the viewport.
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && ['=', '+', '-', '0'].includes(e.key)) e.preventDefault();
});

// Handy for playtesting from the console.
Object.assign(window, { game, Game, view });
