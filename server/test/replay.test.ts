// A bot plays random actions; replaying its inputs must reproduce the run exactly.
import { Game, replay } from '../../src/sim/game';
import { ROOMS } from '../../src/sim/content';
import type { RoomType } from '../../src/sim/types';

function bot(seed: number, cfg = {}): Game {
  const g = new Game(seed, cfg);
  let r = seed;
  const rnd = () => ((r = (r * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const types = Object.keys(ROOMS) as RoomType[];
  for (let i = 0; i < 20000 && !g.ending; i++) {
    if (g.card) g.card.result == null ? g.chooseCard(Math.floor(rnd() * 3)) : g.dismissCard();
    if (g.audit) g.audit.done ? g.dismissAudit() : g.answerAudit(rnd() < 0.5);
    const x = rnd();
    if (x < 0.02) g.build(types[Math.floor(rnd() * types.length)], Math.floor(rnd() * 3), Math.floor(rnd() * 6));
    else if (x < 0.03) g.recruit();
    else if (x < 0.035) g.digFloor();
    else if (x < 0.05 && g.dwellers.length && g.rooms.length) g.assign(g.dwellers[Math.floor(rnd() * g.dwellers.length)].id, g.rooms[Math.floor(rnd() * g.rooms.length)].id);
    else if (x < 0.052) g.cope();
    else if (x < 0.054 && g.bags.length) g.useBag(g.bags[0]);
    else if (x < 0.056 && g.rooms.length) g.pokeHotspot(g.rooms[0].id, 0);
    if (g.phase === 'prep' && i > 500) g.skipPrep();
    if (g.phase === 'drop') g.skipDrop();
    g.step();
  }
  return g;
}

let fails = 0;
for (const seed of [1, 7, 42, 1234, 99999]) {
  for (const cfg of [{}, { defcon: 2 as const }, { tent: true }, { deedTier: 2, loadout: ['safu' as const] }]) {
    const a = bot(seed, cfg);
    const b = replay(seed, cfg, JSON.parse(JSON.stringify(a.inputs)), a.tick);
    const same = JSON.stringify(a.ending) === JSON.stringify(b.ending) && a.day === b.day && JSON.stringify(a.res) === JSON.stringify(b.res);
    if (!same) fails++;
    console.log(`${same ? 'ok  ' : 'FAIL'} seed ${seed} ${JSON.stringify(cfg)} inputs=${a.inputs.length} ticks=${a.tick} -> ${a.ending?.title ?? 'running'} ${a.ending?.score ?? ''} | replay ${b.ending?.title} ${b.ending?.score}`);
  }
}
if (fails) {
  console.error(`${fails} replay mismatches`);
  process.exit(1);
}
