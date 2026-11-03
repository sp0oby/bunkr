// Starting and finishing runs. The server never trusts a score from the browser: it
// replays the recorded inputs from the seed it handed out and takes that result.
import { createHmac } from 'node:crypto';
import { keccak256, type Hash, type Hex } from 'viem';
import { ACTIONS, replay, type Input } from '../src/sim/game';
import { mutatorForDay } from '../src/sim/content';
import { LOADOUT_SLOTS, SHATTER_CHANCE } from '../src/chain/constants';
import { dailySeed } from '../src/meta';
import type { BagId, Defcon, MarketEvent, RunConfig } from '../src/sim/types';
import { bagTiers, lockedBags, runFromTx, settleRun } from './chain';
import { MIN_DAY_GAP_MS, SERVER_SECRET, deployment } from './env';
import { getWeather, marketEventNow } from './weather';
import { db, dailyBoard, type RunRecord } from './store';

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** A deterministic 32-bit number from the server secret. Players can't predict it. */
function hmac32(label: string): number {
  return createHmac('sha256', SERVER_SECRET).update(`${deployment.chainId}:${label}`).digest().readUInt32BE(0);
}

const dayKey = (day: number) => new Date(day * 86400_000).toISOString().slice(0, 10);

function checkSecret(secret: unknown, commit: Hex): Hex {
  if (typeof secret !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(secret)) throw new HttpError(400, 'Bad run secret.');
  if (keccak256(secret as Hex) !== commit) throw new HttpError(403, 'That secret doesn\'t match this run.');
  return secret as Hex;
}

/** Vault perks live in the player's browser, so normal runs take them on trust. They pay nothing out. */
function vaultFrom(v: Record<string, unknown> | undefined): Partial<RunConfig> {
  const o = v ?? {};
  return {
    startRamen: Math.max(0, Math.min(150, Math.floor(Number(o.startRamen) || 0))),
    extraDegen: o.extraDegen === true,
    startBag: o.startBag === true,
    legendLuck: o.legendLuck === true,
    rocket: o.rocket === true,
  };
}

export interface StartBody {
  txHash?: string;
  secret?: string;
  defcon?: number;
  vault?: Record<string, unknown>;
  loadout?: string[];
}

/** Turn a spent ticket into a seed and an official config. Safe to call twice. */
export async function startRun(body: StartBody): Promise<{ runId: number; seed: number; config: Partial<RunConfig> }> {
  if (typeof body.txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(body.txHash)) throw new HttpError(400, 'Bad transaction hash.');
  const entry = await runFromTx(body.txHash as Hash).catch(() => null);
  if (!entry) throw new HttpError(404, 'No run ticket found in that transaction. It may not be mined yet.');
  checkSecret(body.secret, entry.commit);

  const existing = db.run(entry.runId);
  if (existing) return { runId: existing.runId, seed: existing.seed, config: existing.config };

  let config: Partial<RunConfig>;
  let loadout: BagId[] = [];
  let seed: number;
  if (entry.daily) {
    // Daily Doom is a level field: same seed for everyone, standard issue, no perks.
    // Underground days are still dealt per run, so one leaked attempt can't spoil the day.
    seed = dailySeed(dayKey(entry.day));
    config = { defcon: 3, daily: true, deedTier: 1, serverDays: true, mutator: mutatorForDay(entry.day) };
  } else {
    seed = hmac32(`run:${entry.runId}`);
    // The loadout is whatever the player locked into the Forge for this run, not what the
    // client says: locked Bags can't leave the wallet mid-run, so the stakes are real.
    const lock = await lockedBags(entry.runId);
    if (lock.bags.length && !lock.settled) {
      const minTier = await bagTiers();
      loadout = lock.bags.filter((b) => (minTier.get(b) ?? 9) <= entry.tier).slice(0, LOADOUT_SLOTS[entry.tier] ?? 0);
    }
    const defcon = Math.max(1, Math.min(5, Math.floor(Number(body.defcon) || 5))) as Defcon;
    const vault = vaultFrom(body.vault);
    config = {
      ...vault, defcon, daily: false, deedTier: entry.tier, loadout, rocket: vault.rocket || entry.tier >= 3, serverDays: true,
      mutator: mutatorForDay(entry.day),
    };
  }

  config.weather = (await getWeather()).kind;

  const rec: RunRecord = {
    runId: entry.runId, player: entry.player, day: entry.day, daily: entry.daily, tier: entry.tier, commit: entry.commit,
    seed, config, loadout, status: 'started', startedAt: Date.now(),
  };
  db.putRun(rec);
  return { runId: rec.runId, seed, config };
}

const daySeedOf = (runId: number, day: number) => hmac32(`day:${runId}:${day}`);

/**
 * The seed for one underground day, handed out only in order and no faster than a person
 * could play. Without it the game can't go past that day, so nobody can simulate ahead.
 */
export async function daySeed(body: { runId?: number; secret?: string; day?: number }): Promise<{ day: number; seed: number; event: MarketEvent | null }> {
  const rec = db.run(Number(body.runId));
  if (!rec) throw new HttpError(404, 'Unknown run.');
  checkSecret(body.secret, rec.commit);
  if (rec.status !== 'started') throw new HttpError(409, 'This run is over.');
  const day = Number(body.day);
  const times = rec.dayTimes ?? [];
  if (!Number.isInteger(day) || day < 1 || day > times.length + 1) throw new HttpError(400, 'Days come one at a time.');
  if (day === times.length + 1) {
    const wait = times.length ? times[times.length - 1] + MIN_DAY_GAP_MS - Date.now() : 0;
    if (wait > 0) throw new HttpError(429, `Too fast. Try again in ${Math.ceil(wait / 1000)}s.`);
    rec.dayTimes = [...times, Date.now()];
    const ev = day > 1 ? await marketEventNow() : null;
    if (ev) rec.dayEvents = { ...rec.dayEvents, [day]: ev };
    db.putRun(rec);
  }
  return { day, seed: daySeedOf(rec.runId, day), event: rec.dayEvents?.[day] ?? null };
}

export interface FinishBody {
  runId?: number;
  secret?: string;
  ticks?: number;
  inputs?: unknown;
}

const MAX_TICKS = 2_000_000;
const MAX_INPUTS = 50_000;

function parseInputs(raw: unknown): Input[] {
  if (!Array.isArray(raw) || raw.length > MAX_INPUTS) throw new HttpError(400, 'Bad input log.');
  let last = 0;
  return raw.map((x) => {
    if (!Array.isArray(x) || x.length !== 3) throw new HttpError(400, 'Bad input.');
    const [tick, name, args] = x;
    if (!Number.isInteger(tick) || tick < last || tick > MAX_TICKS) throw new HttpError(400, 'Inputs out of order.');
    if (!ACTIONS.includes(name) || !Array.isArray(args) || args.length > 4) throw new HttpError(400, 'Unknown input.');
    if (!args.every((a) => a === null || ['number', 'string', 'boolean'].includes(typeof a))) throw new HttpError(400, 'Bad input args.');
    last = tick;
    return [tick, name, args] as Input;
  });
}

export interface FinishResult {
  runId: number;
  score: number;
  title: string;
  survived: boolean;
  verified: true;
  shattered: BagId[];
  dailyRank: number | null;
}

/** Replay the run, record the real result, and roll shatters if it ended in liquidation. */
export async function finishRun(body: FinishBody): Promise<FinishResult> {
  const rec = db.run(Number(body.runId));
  if (!rec) throw new HttpError(404, 'Unknown run. Start it first.');
  checkSecret(body.secret, rec.commit);
  if (rec.status === 'finished') return summary(rec);
  if (rec.status === 'abandoned') throw new HttpError(409, 'This run timed out and was counted as liquidated.');

  const ticks = Number(body.ticks);
  if (!Number.isInteger(ticks) || ticks < 0 || ticks > MAX_TICKS) throw new HttpError(400, 'Bad tick count.');
  const inputs = parseInputs(body.inputs);
  // Only the days this player actually reached (and was handed) can be replayed.
  const seeds = new Map((rec.dayTimes ?? []).map((_, i) => [i + 1, daySeedOf(rec.runId, i + 1)] as [number, number]));
  let g;
  try {
    const events = new Map(Object.entries(rec.dayEvents ?? {}).map(([d, e]) => [Number(d), e] as [number, MarketEvent]));
    g = replay(rec.seed, rec.config, inputs, ticks, seeds, events);
  } catch {
    throw new HttpError(400, 'That input log doesn\'t replay.');
  }
  if (!g.ending) throw new HttpError(400, 'The run hasn\'t ended yet.');
  const e = g.ending;
  rec.status = 'finished';
  rec.finishedAt = Date.now();
  rec.result = { score: e.score, title: e.title, survived: e.survived, day: g.day, tent: !!e.tent, ticks, inputs: inputs.length };
  db.putRun(rec);
  await settleBags(rec);
  return summary(rec);
}

/**
 * Close the run's lock in the Forge. Survived: every Bag goes home. Liquidated or abandoned:
 * each carried Bag has a SHATTER_CHANCE of being burned, the rest go home.
 */
export async function settleBags(rec: RunRecord): Promise<void> {
  if (rec.daily || rec.shattered) return;
  const lock = await lockedBags(rec.runId).catch(() => null);
  if (!lock || !lock.bags.length || lock.settled) return;
  const lost = rec.status === 'abandoned' || !rec.result?.survived;
  // Only Bags that counted as carried at the start can break; anything locked later just goes home.
  const broken = lost ? rec.loadout.filter((b) => lock.bags.includes(b) && hmac32(`shatter:${rec.runId}:${b}`) / 2 ** 32 < SHATTER_CHANCE) : [];
  try {
    rec.shatterTxs = [await settleRun(rec.runId, broken)];
    rec.shattered = broken;
  } catch (err) {
    // Left unsettled: the next sweep retries, and the player can reclaim after a week.
    console.warn(`settling Bags for run ${rec.runId} failed:`, (err as Error).message.split('\n')[0]);
  }
  db.putRun(rec);
}

function summary(rec: RunRecord): FinishResult {
  const board = rec.daily ? dailyBoard(rec.day) : [];
  const rank = rec.daily ? board.findIndex((r) => r.player.toLowerCase() === rec.player.toLowerCase()) : -1;
  return {
    runId: rec.runId, score: rec.result!.score, title: rec.result!.title, survived: rec.result!.survived, verified: true,
    shattered: rec.shattered ?? [], dailyRank: rank >= 0 ? rank + 1 : null,
  };
}

/** Runs that never reported back: forged Bags are rolled as if liquidated. */
export async function sweepAbandoned(now = Date.now(), abandonMs: number): Promise<number> {
  let n = 0;
  for (const rec of db.runs()) {
    if (rec.status !== 'started' || now - rec.startedAt < abandonMs) continue;
    rec.status = 'abandoned';
    db.putRun(rec);
    await settleBags(rec);
    n++;
  }
  return n;
}
