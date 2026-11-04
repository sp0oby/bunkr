// Clip mode: stages one moment of a run for recording social clips.
//   /?clip=<scene>              the scene, in the normal landscape frame (X's standard video shape)
//   &shape=square               a 1:1 frame instead (bigger in the X phone app)
//   &ui=full|min|0              full HUD (default), just the story (cards, bosses, HATCH), or nothing
//   &seed=N                     a different take (every take with the same seed is identical)
//   &bags=overclockgpu,...      carry Bags into it (Stock Bags included)
// Nothing from a clip run is saved: no Ramen Futures, no stats, no server.
import { Game } from './sim/game';
import { BAGS, COLS, ROOMS } from './sim/content';
import type { BagId, RoomType, RunConfig } from './sim/types';

export const CLIP_SCENES = {
  bunker: 'A busy bunker on day 4',
  drop: 'The last seconds of prep, then the bombs',
  raid: 'Day 10: the Liquidators come through the porta-potty',
  audit: 'Day 20: the S.E.C. audit',
  whale: 'Day 28: the Mutant Whale',
  pressf: 'A degen gets liquidated: mash F',
  ragequit: 'It\'s so over: degens rage-quit',
  yolo: 'We\'re so back: degens YOLO outside',
  survive: 'Day 30: you made it (the PnL card)',
} as const;
export type ClipScene = keyof typeof CLIP_SCENES;

export const isClipScene = (s: string | null): s is ClipScene => !!s && s in CLIP_SCENES;

/** The run config for a clip: a full Bunker Deed run, carrying whatever Bags were asked for. */
export function clipConfig(params: URLSearchParams): Partial<RunConfig> {
  const bags = (params.get('bags') ?? '').split(',').filter((b): b is BagId => b in BAGS).slice(0, 3);
  return { defcon: 5, daily: false, deedTier: 3, loadout: bags, rocket: true, mutator: null };
}

/** Frame the page (landscape by default, or square) and trim the HUD for recording. */
export function frameClip(params: URLSearchParams): void {
  const b = document.body.classList;
  b.add('clip');
  if (params.get('shape') === 'square') b.add('clip-square');
  const ui = params.get('ui');
  if (ui === 'min') b.add('clip-min');
  if (ui === '0') b.add('clip-bare');
  window.dispatchEvent(new Event('resize'));
}

const LAYOUT: RoomType[] = ['reactor', 'reactor', 'kitchen', 'kitchen', 'pool', 'pool', 'copium', 'grass', 'shill', 'rugdetector', 'storage', 'memelab'];

function place(g: Game, t: RoomType): void {
  g.res.ramen = Math.max(g.res.ramen, 5000);
  for (let tries = 0; tries < 6; tries++) {
    for (let f = 0; f < g.floorsDug; f++) for (let c = 0; c < COLS; c++) if (g.canBuildAt(f, c) && g.build(t, f, c)) return;
    if (!g.digFloor()) return;
  }
}

function staff(g: Game): void {
  for (const room of g.rooms) {
    if (!ROOMS[room.type].stat) continue;
    while (g.workersIn(room).length < g.capacity(room)) {
      const idle = g.present.find((d) => d.roomId == null);
      if (!idle || !g.assign(idle.id, room.id)) break;
    }
  }
}

/** Keep the bunker healthy and the vibes sane while skipping ahead. */
function tend(g: Game): void {
  g.res.ramen = Math.max(g.res.ramen, 300);
  g.res.water = Math.max(g.res.water, 200);
  g.res.power = Math.max(g.res.power, 150);
  g.res.copium = Math.max(g.res.copium, 40);
  g.rads = Math.min(g.rads, 20);
  g.vibe *= 0.5;
  for (const d of g.alive) d.hp = Math.max(d.hp, 90);
}

/** Step the sim until `until` is true, answering everything that pops up along the way. */
function skip(g: Game, until: (g: Game) => boolean, max = 400_000): void {
  for (let i = 0; i < max && !g.ending && !until(g); i++) {
    if (g.card) g.card.result == null ? g.chooseCard(0) : g.dismissCard();
    if (g.revive) g.revive.done ? g.dismissRevive() : g.pressF();
    if (g.audit) g.audit.done ? g.dismissAudit() : g.answerAudit(g.audit.forms[g.audit.idx].legit);
    if (g.raid) g.smash();
    if (g.phase === 'drop') g.skipDrop();
    const need = g.awaitingDay();
    if (need != null) g.daySeeds.set(need, 7000 + need);
    if (g.underground) tend(g);
    if (i % 400 === 0) staff(g);
    g.step();
  }
  // Whatever we skipped past shouldn't greet the viewer.
  if (g.card && !until(g)) g.dismissCard();
  g.newBag = null;
  g.newLegend = null;
}

/** Recruit a crowd and build a good-looking bunker during prep. */
function buildUp(g: Game): void {
  for (let i = 0; i < 8; i++) {
    g.res.ramen = Math.max(g.res.ramen, 5000);
    g.recruit();
  }
  for (const t of LAYOUT) place(g, t);
  staff(g);
  g.res.ramen = 260;
}

/** Fast-forward a fresh game to the start of a scene. */
export function stageClip(g: Game, scene: ClipScene): void {
  buildUp(g);
  const atDay = (day: number) => (x: Game) => x.underground && x.day >= day;
  switch (scene) {
    case 'drop':
      g.phaseTime = g.prepSeconds - 4;
      return;
    case 'bunker':
      skip(g, atDay(4));
      break;
    case 'raid':
      skip(g, (x) => !!x.raid && x.raid.kind === 'liquidators');
      break;
    case 'audit':
      skip(g, (x) => !!x.audit);
      break;
    case 'whale':
      skip(g, (x) => !!x.raid && x.raid.kind === 'whale');
      break;
    case 'pressf': {
      skip(g, atDay(3));
      const d = g.present.find((x) => !x.revived);
      if (d) g.kill(d, 'a raccoon with a grudge');
      break;
    }
    case 'ragequit':
    case 'yolo':
      skip(g, atDay(4));
      break;
    case 'survive':
      skip(g, (x) => x.day >= 30 && x.underground && x.dayProgress > 0.85);
      break;
  }
  // A comfortable cushion so the scene plays out without anyone starving on camera.
  tend(g);
  // The vibe scenes start pinned to one end of the meter (after tend, which calms things down).
  if (scene === 'ragequit' || scene === 'yolo') {
    const dir = scene === 'ragequit' ? -1 : 1;
    g.vibe = 100 * dir;
    g.vibeVel = 4 * dir;
  }
  g.log = [];
  // Drop the sounds and flashes queued while skipping ahead; keep the camera cue for a boss.
  g.fx.length = 0;
  if (g.raid) g.fx.push('raid');
}
