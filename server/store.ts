// Runs and settlement progress, kept in one JSON file. Plenty for testnet; swap for a
// database before mainnet traffic.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Address, Hex } from 'viem';
import type { BagId, MarketEvent, RunConfig } from '../src/sim/types';
import { DATA_FILE } from './env';

export interface RunResult {
  score: number;
  title: string;
  survived: boolean;
  day: number;
  tent: boolean;
  ticks: number;
  inputs: number;
}

export interface RunRecord {
  runId: number;
  player: Address;
  /** UTC day index (block.timestamp / 1 day) the ticket was spent. */
  day: number;
  daily: boolean;
  tier: number;
  commit: Hex;
  seed: number;
  config: Partial<RunConfig>;
  loadout: BagId[];
  status: 'started' | 'finished' | 'abandoned';
  /** When each underground day's seed was handed out (index 0 = day 1). */
  dayTimes?: number[];
  /** Market events dealt with those days, by day number. */
  dayEvents?: Record<number, MarketEvent>;
  startedAt: number;
  finishedAt?: number;
  result?: RunResult;
  shattered?: BagId[];
  shatterTxs?: Hex[];
  /** Oracle-signed proof per Bag found this run, for forgeFound. */
  vouchers?: Partial<Record<BagId, Hex>>;
}

interface Data {
  runs: Record<string, RunRecord>;
  /** Highest UTC day whose pot has been settled or rolled. */
  settledThrough: number | null;
  settlements: Record<string, { tx: Hex; winners: Address[]; amount: string; kind: 'settled' | 'rolled' }>;
}

let data: Data = { runs: {}, settledThrough: null, settlements: {} };
if (existsSync(DATA_FILE)) data = { ...data, ...JSON.parse(readFileSync(DATA_FILE, 'utf8')) };

export function save(): void {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 1));
  renameSync(tmp, DATA_FILE);
}

export const db = {
  run: (id: number): RunRecord | undefined => data.runs[id],
  putRun(r: RunRecord): void {
    data.runs[r.runId] = r;
    save();
  },
  runs: (): RunRecord[] => Object.values(data.runs),
  get settledThrough() {
    return data.settledThrough;
  },
  markSettled(day: number, rec: Data['settlements'][string]): void {
    data.settlements[day] = rec;
    data.settledThrough = Math.max(data.settledThrough ?? day, day);
    save();
  },
  skipDay(day: number): void {
    data.settledThrough = Math.max(data.settledThrough ?? day, day);
    save();
  },
  settlement: (day: number) => data.settlements[day],
};

/** Best finished Daily Doom result per player for a day, highest score first. */
export function dailyBoard(day: number): RunRecord[] {
  const best = new Map<string, RunRecord>();
  for (const r of data.runs ? Object.values(data.runs) : []) {
    if (!r.daily || r.day !== day || r.status !== 'finished' || !r.result) continue;
    const key = r.player.toLowerCase();
    const cur = best.get(key);
    if (!cur || r.result.score > cur.result!.score) best.set(key, r);
  }
  return [...best.values()].sort((a, b) => b.result!.score - a.result!.score || a.finishedAt! - b.finishedAt!);
}
