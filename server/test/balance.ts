// Balance check: a decent-player bot runs many seeds per setting and reports survival and
// scores. Run: npx tsx server/test/balance.ts [runs]
import { Game } from '../../src/sim/game';
import { COLS, MUTATORS, ROOMS } from '../../src/sim/content';
import type { Defcon, MutatorId, RoomType, RunConfig } from '../../src/sim/types';

const RUNS = Number(process.argv[2] ?? 60);

function bot(seed: number, cfg: Partial<RunConfig>): Game {
  const g = new Game(seed, cfg);
  let r = seed * 7 + 3;
  const rnd = () => ((r = (r * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const wants: RoomType[] = ['reactor', 'kitchen', 'pool', 'kitchen', 'copium', 'reactor', 'grass', 'rugdetector', 'storage', 'pool', 'kitchen', 'shill', 'memelab', 'silo'];
  const build = () => {
    for (const t of wants) {
      const have = g.rooms.filter((x) => x.type === t).reduce((s, x) => s + x.width, 0);
      const want = wants.filter((w) => w === t).length;
      if (have >= want || !g.canBuildType(t) || g.res.ramen < g.buildCost(t) + 30) continue;
      for (let f = 0; f < g.floorsDug; f++) for (let c = 0; c < COLS; c++) if (g.canBuildAt(f, c) && g.build(t, f, c)) return;
      if (g.res.ramen > g.digCost() + 60) g.digFloor();
      return;
    }
  };
  const staff = () => {
    for (const room of g.rooms) {
      const stat = ROOMS[room.type].stat;
      if (!stat) continue;
      while (g.workersIn(room).length < g.capacity(room)) {
        const idle = g.present.filter((d) => d.roomId == null).sort((a, b) => g.stat(b, stat) - g.stat(a, stat))[0];
        if (!idle || !g.assign(idle.id, room.id)) break;
      }
    }
  };
  for (let i = 0; i < 400_000 && !g.ending; i++) {
    if (g.card) {
      if (g.card.result == null) g.chooseCard(Math.floor(rnd() * g.card.def.options.length));
      else g.dismissCard();
    }
    if (g.audit) g.audit.done ? g.dismissAudit() : g.answerAudit(rnd() < 0.8 ? g.audit.forms[g.audit.idx].legit : rnd() < 0.5);
    if (g.revive) {
      // A human wins the F-mash about 60% of the time.
      if (g.revive.done) g.dismissRevive();
      else if (rnd() < 0.6) for (let k = 0; k < 50; k++) g.pressF();
    }
    if (g.raid && rnd() < 0.5) g.smash();
    if (g.raid && g.missiles) g.fireSilo();
    if (i % 25 === 0) {
      build();
      staff();
      if (Math.abs(g.vibe) > 55 && g.res.copium >= g.copeCost()) g.cope();
      if (g.phase === 'prep' && g.phaseTime > 40) g.skipPrep();
    }
    if (g.phase === 'drop') g.skipDrop();
    if (g.awaitingDay() != null) g.daySeeds.set(g.awaitingDay()!, seed * 31 + g.awaitingDay()!);
    g.step();
  }
  return g;
}

function report(label: string, cfg: Partial<RunConfig>) {
  let won = 0, score = 0, days = 0;
  const titles = new Map<string, number>();
  for (let s = 1; s <= RUNS; s++) {
    const g = bot(s * 977, cfg);
    if (g.ending?.survived) won++;
    score += g.ending?.score ?? 0;
    days += Math.min(g.day, 30);
    titles.set(g.ending?.title ?? '?', (titles.get(g.ending?.title ?? '?') ?? 0) + 1);
  }
  const top = [...titles].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => `${t} ${n}`).join(', ');
  console.log(`${label.padEnd(26)} survive ${String(Math.round((won / RUNS) * 100)).padStart(3)}%  avg day ${(days / RUNS).toFixed(1).padStart(4)}  avg score ${Math.round(score / RUNS).toString().padStart(5)}  | ${top}`);
}

for (const d of [5, 3] as Defcon[]) report(`DEFCON ${d}`, { defcon: d });
for (const m of Object.keys(MUTATORS) as MutatorId[]) report(`DEFCON 5 + ${MUTATORS[m].name}`, { defcon: 5, mutator: m });
