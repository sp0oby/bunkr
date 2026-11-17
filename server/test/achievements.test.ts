// Achievements: each one fires when it should, and a replay earns exactly what the live run did
// (that's what lets the results server verify them).
// npx tsx server/test/achievements.test.ts
import { Game, replay } from '../../src/sim/game';
import { ROOMS } from '../../src/sim/content';
import { ACHIEVEMENTS, earnedBy, type AchId } from '../../src/sim/achievements';
import type { Ending, RoomType, RunConfig } from '../../src/sim/types';

let fails = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) fails++;
};

// ---------- 1. Every rule, against a hand-set ending
function ended(cfg: Partial<RunConfig>, end: Partial<Ending>, tweak?: (g: Game) => void): AchId[] {
  const g = new Game(5, cfg);
  tweak?.(g);
  g.ending = { title: 'LIQUIDATED', blurb: '', score: 0, breakdown: [], survived: false, defcon: g.config.defcon, daily: g.config.daily, ...end };
  return earnedBy(g);
}
const has = (ids: AchId[], id: AchId) => ids.includes(id);

check(earnedBy(new Game(5, {})).length === 0, 'an unfinished run earns nothing');
const dead = ended({}, {}, (g) => (g.day = 1));
check(has(dead, 'gm') && has(dead, 'ngmi') && !has(dead, 'touchgrass'), 'liquidated on day 1: gm + ngmi, not Touched Grass');
check(!has(ended({}, {}, (g) => (g.day = 5)), 'ngmi'), 'liquidated on day 5 is not ngmi');
check(has(ended({ tent: true }, { title: 'TENT COLLAPSED', tent: true }), 'tentlife'), 'tent run: Tent Life');
const win = ended({ defcon: 1 }, { title: 'TOUCHED GRASS', survived: true }, (g) => { g.stats.raidsWon = 1; });
check(['touchgrass', 'diamondhands', 'nocasualties', 'undefeated'].every((id) => has(win, id as AchId)), 'clean DEFCON 1 win: Touched Grass, Diamond Hands, No Degen Left Behind, Fortress');
check(!has(ended({}, { survived: true }, (g) => { g.stats.deaths = 1; g.stats.raidsLost = 1; }), 'nocasualties'), 'a death rules out No Degen Left Behind');
check(has(ended({ daily: true }, { survived: true }), 'doomscroller'), 'surviving a Daily Doom: Doomscroller');
for (const [title, id] of [['BUNKER DAO', 'dao'], ['LAST DEGENS STANDING', 'laststanding'], ['RAMEN BARON', 'baron'], ['BECAME THE RAIDERS', 'raiders'], ['EXIT LIQUIDITY', 'exit'], ['RUGGED YOUR OWN BUNKER', 'rug']] as const) {
  check(has(ended({}, { title, survived: !['EXIT LIQUIDITY', 'RUGGED YOUR OWN BUNKER'].includes(title) }), id), `ending ${title}: ${id}`);
}
check(has(ended({}, {}, (g) => (g.stats.whaleSlain = true)), 'whale'), 'whale slain: Whale Hunter');
check(has(ended({}, {}, (g) => (g.stats.launched = true)), 'moon'), 'rocket launched: Literally to the Moon');
check(has(ended({}, {}, (g) => (g.stats.auditsPassed = 1)), 'audit'), 'audit passed: Clean Books');
check(has(ended({}, {}, (g) => (g.stats.revives = 1)), 'pressf'), 'revive: Press F');
check(has(ended({}, {}, (g) => (g.stats.quits = 3)), 'paperhands') && !has(ended({}, {}, (g) => (g.stats.quits = 2)), 'paperhands'), 'Paper Hands needs 3 quits');
check(has(ended({}, { survived: true }, (g) => (g.bags = ['overclockgpu'])), 'stonks'), 'surviving with a Stock Bag: Stonks');
check(!has(ended({}, { survived: false }, (g) => (g.bags = ['overclockgpu'])), 'stonks'), 'dying with a Stock Bag is not Stonks');
check(new Set(ACHIEVEMENTS.map((a) => a.id)).size === ACHIEVEMENTS.length, `${ACHIEVEMENTS.length} achievements, ids unique`);

// ---------- 2. Replays earn the same thing as the live run
function bot(seed: number, cfg: Partial<RunConfig>): Game {
  const g = new Game(seed, cfg);
  let r = seed;
  const rnd = () => ((r = (r * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const types = Object.keys(ROOMS) as RoomType[];
  for (let i = 0; i < 40000 && !g.ending; i++) {
    if (g.card) g.card.result == null ? g.chooseCard(Math.floor(rnd() * 3)) : g.dismissCard();
    if (g.audit) g.audit.done ? g.dismissAudit() : g.answerAudit(rnd() < 0.5);
    if (g.revive) g.revive.done ? g.dismissRevive() : rnd() < 0.7 && g.pressF();
    if (g.raid && rnd() < 0.4) g.smash();
    const x = rnd();
    if (x < 0.02) g.build(types[Math.floor(rnd() * types.length)], Math.floor(rnd() * 3), Math.floor(rnd() * 6));
    else if (x < 0.03) g.recruit();
    else if (x < 0.035) g.digFloor();
    else if (x < 0.05 && g.dwellers.length && g.rooms.length) g.assign(g.dwellers[Math.floor(rnd() * g.dwellers.length)].id, g.rooms[Math.floor(rnd() * g.rooms.length)].id);
    if (g.phase === 'prep' && i > 500) g.skipPrep();
    if (g.phase === 'drop') g.skipDrop();
    const need = g.awaitingDay();
    if (need != null) g.daySeeds.set(need, (seed * 7919 + need * 104729) >>> 0);
    g.step();
  }
  return g;
}
const seen = new Set<AchId>();
for (const seed of [1, 7, 42, 1234, 99999, 31337]) {
  for (const cfg of [{}, { defcon: 2 as const }, { tent: true }, { daily: true, defcon: 3 as const }]) {
    const a = bot(seed, cfg);
    const b = replay(seed, cfg, JSON.parse(JSON.stringify(a.inputs)), a.tick, a.daySeeds);
    const ea = earnedBy(a), eb = earnedBy(b);
    ea.forEach((id) => seen.add(id));
    check(JSON.stringify(ea) === JSON.stringify(eb), `seed ${seed} ${JSON.stringify(cfg)} -> ${a.ending?.title ?? 'running'} day ${a.day}: [${ea.join(', ')}] replays the same`);
  }
}
console.log(`bots earned: ${[...seen].join(', ') || 'nothing'}`);

if (fails) {
  console.error(`${fails} failed`);
  process.exit(1);
}
console.log('\nachievements check out');
