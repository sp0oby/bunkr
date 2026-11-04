// Plays the same seeded runs with and without each Stock Bag and measures every power.
// npx tsx server/test/stockbags.test.ts
import { Game } from '../../src/sim/game';
import { COLS, ROOMS } from '../../src/sim/content';
import type { BagId, RoomType } from '../../src/sim/types';

let fails = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) fails++;
};
const mk = (seed: number, loadout: BagId[]) => new Game(seed, { defcon: 5, loadout, deedTier: 3, serverDays: false });

/** Build a room in the first open slot, digging if needed. */
function place(g: Game, t: RoomType): boolean {
  g.res.ramen = Math.max(g.res.ramen, 2000);
  for (let tries = 0; tries < 6; tries++) {
    for (let f = 0; f < g.floorsDug; f++) for (let c = 0; c < COLS; c++) if (g.canBuildAt(f, c) && g.build(t, f, c)) return true;
    g.digFloor();
  }
  return false;
}
function staff(g: Game) {
  for (const room of g.rooms) {
    if (!ROOMS[room.type].stat) continue;
    while (g.workersIn(room).length < g.capacity(room)) {
      const idle = g.present.find((d) => d.roomId == null);
      if (!idle || !g.assign(idle.id, room.id)) break;
    }
  }
}
/** A caretaker bot: answers cards and bosses, keeps everyone fed, runs until `until` returns true. */
function play(g: Game, until: (g: Game) => boolean, maxSteps = 300_000, onStep?: (g: Game) => void) {
  g.skipPrep();
  for (let i = 0; i < maxSteps && !g.ending && !until(g); i++) {
    if (g.card) g.card.result == null ? g.chooseCard(0) : g.dismissCard();
    if (g.revive) g.revive.done ? g.dismissRevive() : g.pressF();
    if (g.raid) g.smash();
    if (g.phase === 'drop') g.skipDrop();
    const need = g.awaitingDay();
    if (need != null) g.daySeeds.set(need, 1000 + need);
    if (g.underground) {
      g.res.ramen = Math.max(g.res.ramen, 200); g.res.water = Math.max(g.res.water, 150); g.res.power = Math.max(g.res.power, 100);
      for (const d of g.alive) d.hp = Math.max(d.hp, 80);
    }
    onStep?.(g);
    g.step();
  }
}

// ---------- COST: Executive Membership
{
  const a = mk(1, []), b = mk(1, ['execmembership']);
  check(b.buildCost('reactor') === Math.round(a.buildCost('reactor') * 0.85), `COST: rooms cost 15% less (reactor ${a.buildCost('reactor')} -> ${b.buildCost('reactor')})`);
  const capA = a.caps().ramen, capB = b.caps().ramen;
  place(a, 'storage'); place(b, 'storage');
  check(b.caps().ramen - capB === 2 * (a.caps().ramen - capA), `COST: Cold Storage holds twice as much (+${a.caps().ramen - capA} -> +${b.caps().ramen - capB} ramen)`);
}

// ---------- NVDA: Overclocked GPU
{
  const a = mk(2, []), b = mk(2, ['overclockgpu']);
  check(Math.abs(b.outputMult() / a.outputMult() - 1.25) < 1e-9, 'NVDA: every room makes 25% more');
  for (const g of [a, b]) { place(g, 'kitchen'); place(g, 'pool'); staff(g); g.res.power = 500; g.step(); }
  // No reactor: the only power flow is the rooms' drain (the kitchen's ramen rate is the boosted output).
  check(Math.abs(b.rates.power / a.rates.power - 1.3) < 1e-6, `NVDA: rooms eat 30% more power (${a.rates.power.toFixed(4)} -> ${b.rates.power.toFixed(4)}/s)`);
}

// ---------- SPCX: Starship Boarding Pass
{
  const a = mk(3, ['moonmap']), b = mk(3, ['starshippass']);
  check(b.canBuildType('rocket') && !mk(3, []).canBuildType('rocket'), 'SPCX: Rocket Room buildable from day 1 (without the Map to the Moon)');
  const progAt = (g: Game) => {
    place(g, 'rocket'); staff(g);
    play(g, (x) => x.day >= 2);
    return g.rocketProg;
  };
  const pa = progAt(a), pb = progAt(b);
  check(pb < 100 && Math.abs(pb / pa - 2) < 0.05, `SPCX: rocket builds twice as fast (${pa.toFixed(1)}% vs ${pb.toFixed(1)}% by day 2)`);
  b.rocketProg = 100;
  b.launch();
  const line = b.ending?.breakdown.find(([k]) => k === 'Starship Boarding Pass');
  check(b.ending?.title === 'MOON MISSION' && line?.[1] === 1000, `SPCX: Moon Mission scores +1,000 (${line ? line[1] : 'missing'})`);
}

// ---------- TSLA: Cybertruck Keys
{
  const trip = (bag: BagId[]) => {
    const g = mk(4, bag);
    play(g, (x) => x.day >= 2);
    const d = g.present.find((x) => x.arch !== 'coldcarl')!;
    g.sendExpedition(d.id, 'gz');
    return d.exp!.returnAt - d.exp!.leftAt;
  };
  const ta = trip([]), tb = trip(['cybertruckkeys']);
  check(Math.abs(tb / ta - 0.6) < 1e-9, `TSLA: expeditions 40% faster (${ta}s -> ${tb}s)`);
  // Death odds: send one degen to Ground Zero across many seeds, count funerals.
  const deaths = (bag: BagId[]) => {
    let dead = 0, n = 0;
    for (let s = 1; s <= 400; s++) {
      const g = mk(100 + s, bag);
      play(g, (x) => x.day >= 2);
      const d = g.present.find((x) => x.arch !== 'coldcarl' && x.arch !== 'midcurve');
      if (!d || !g.sendExpedition(d.id, 'gz')) continue;
      n++;
      play(g, () => d.status !== 'expedition', 50_000);
      if (d.status === 'dead') dead++;
    }
    return dead / n;
  };
  const da = deaths([]), db = deaths(['cybertruckkeys']);
  check(db < da * 0.85 && db > da * 0.45, `TSLA: about a third fewer funerals (${(da * 100).toFixed(1)}% -> ${(db * 100).toFixed(1)}% died at Ground Zero)`);
}

// ---------- AMC: Bunker Cinema
{
  const swing = (bag: BagId[]) => {
    const g = mk(5, bag);
    let sum = 0, n = 0;
    play(g, (x) => x.day >= 8, 300_000, (x) => { if (x.underground) { sum += Math.abs(x.vibe); n++; } });
    return { avg: sum / n, nights: g.log.filter((l) => l.text.startsWith('Movie Night')).length, g };
  };
  const a = swing([]), b = swing(['bunkercinema']);
  check(b.avg < a.avg * 0.8, `AMC: calmer vibes (average swing ${a.avg.toFixed(1)} -> ${b.avg.toFixed(1)})`);
  check(b.nights >= 5 && a.nights === 0, `AMC: Movie Night every evening (${b.nights} by day 8; log keeps the last 80 lines)`);
}

// ---------- PLTR: The Seeing Stone
{
  const run = (bag: BagId[]) => {
    const g = mk(6, bag);
    let raidHp = 0, forms: { legit: boolean; flagged?: boolean }[] = [];
    const warnings: string[] = [];
    let seen = 0;
    play(g, (x) => x.day >= 21, 400_000, (x) => {
      for (const l of x.log) if (l.id >= seen && l.text.startsWith('SEEING STONE')) warnings.push(`day ${l.day}: ${l.text}`);
      seen = x.log.length ? x.log[x.log.length - 1].id + 1 : seen;
      if (x.raid && !raidHp && x.raid.kind === 'liquidators') raidHp = x.raid.maxHp;
      if (x.audit && !forms.length) forms = x.audit.forms.map((f) => ({ legit: f.legit, flagged: f.flagged }));
      if (x.audit) x.audit.done ? x.dismissAudit() : x.answerAudit(x.audit.forms[x.audit.idx].legit);
    });
    return { raidHp, forms, warnings };
  };
  const a = run([]), b = run(['seeingstone']);
  check(a.raidHp > 0 && Math.abs(b.raidHp / a.raidHp - 0.8) < 1e-9, `PLTR: Liquidators arrive 20% weaker (${a.raidHp.toFixed(0)} -> ${b.raidHp.toFixed(0)} HP)`);
  const ok = b.forms.length === 6 && b.forms.every((f) => !!f.flagged === !f.legit) && a.forms.every((f) => !f.flagged);
  check(ok, `PLTR: every fraud form flagged, no legit one (${b.forms.filter((f) => f.flagged).length} of ${b.forms.filter((f) => !f.legit).length} fraud forms)`);
  check(b.warnings.some((w) => w.startsWith('day 9:')) && b.warnings.some((w) => w.startsWith('day 19:')) && a.warnings.length === 0,
    `PLTR: warned a day ahead (${b.warnings.map((w) => w.split(':')[0]).join(', ')})`);
}

console.log(fails ? `\n${fails} failure(s)` : '\nall six Stock Bags do what they say');
process.exit(fails ? 1 : 0);
