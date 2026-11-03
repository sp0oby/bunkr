// Progress that survives between runs: DEFCON unlocks, Ramen Futures (the meta
// currency), Vault unlocks, best scores and Daily Doom. Stored in localStorage;
// everything degrades gracefully if storage is unavailable.
import type { Defcon, Ending, RunConfig } from './sim/types';

export type VaultId = 'stash' | 'extraDegen' | 'startBag' | 'legendLuck' | 'rocket';

export interface VaultItem {
  id: VaultId;
  name: string;
  desc: string;
  /** Cost per level. */
  costs: number[];
}

export const VAULT: VaultItem[] = [
  { id: 'stash', name: 'Ramen Stash', desc: '+50 starting ramen per level. Buried before the bombs.', costs: [8, 18, 35] },
  { id: 'extraDegen', name: 'Plus-One', desc: 'Start every run with a 4th degen.', costs: [30] },
  { id: 'startBag', name: 'Go-Bag', desc: 'Start every run holding a random Bag.', costs: [40] },
  { id: 'legendLuck', name: 'Legendary Group Chat', desc: 'Legendary degens show up 3× as often.', costs: [55] },
  { id: 'rocket', name: 'Rocket Blueprints', desc: 'Unlocks the Rocket Room — and the Moon Mission ending.', costs: [80] },
];

export interface Meta {
  rf: number;
  /** Lowest (hardest) DEFCON unlocked. 5 = only the base level. */
  unlocked: Defcon;
  vault: Partial<Record<VaultId, number>>;
  best: Record<string, number>;
  daily: { date: string; score: number } | null;
  runs: number;
  wins: number;
}

const KEY = 'bunkr.meta.v1';
const fresh = (): Meta => ({ rf: 0, unlocked: 5, vault: {}, best: {}, daily: null, runs: 0, wins: 0 });

export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...fresh(), ...JSON.parse(raw) } : fresh();
  } catch {
    return fresh();
  }
}

export function saveMeta(m: Meta): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* storage unavailable: progress lives for this session only */
  }
}

export const vaultLevel = (m: Meta, id: VaultId) => m.vault[id] ?? 0;

// ---------- Save codes ----------
// Progress lives in this browser. A save code carries it to another one.
// The checksum catches typos; it isn't security (it's your own progress).

function fnv(text: string): string {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function exportCode(m: Meta): string {
  const body = btoa(unescape(encodeURIComponent(JSON.stringify(m)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `BUNKR1.${body}.${fnv(body)}`;
}

/** Replaces this browser's progress with the code's. Returns an error message, or null. */
export function importCode(m: Meta, code: string): string | null {
  const parts = code.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'BUNKR1') return 'That is not a BUNKR save code.';
  const [, body, sum] = parts;
  if (fnv(body) !== sum) return 'That code is damaged. Copy the whole thing.';
  let data: Partial<Meta>;
  try {
    data = JSON.parse(decodeURIComponent(escape(atob(body.replace(/-/g, '+').replace(/_/g, '/')))));
  } catch {
    return 'That code is damaged. Copy the whole thing.';
  }
  if (typeof data.rf !== 'number' || typeof data.unlocked !== 'number' || typeof data.runs !== 'number') return 'That code is missing progress data.';
  Object.assign(m, fresh(), data);
  saveMeta(m);
  return null;
}

export function buyVault(m: Meta, id: VaultId): boolean {
  const item = VAULT.find((v) => v.id === id)!;
  const lvl = vaultLevel(m, id);
  const cost = item.costs[lvl];
  if (cost == null || m.rf < cost) return false;
  m.rf -= cost;
  m.vault[id] = lvl + 1;
  saveMeta(m);
  return true;
}

export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Everyone gets the same seed on the same day. */
export function dailySeed(day = todayKey()): number {
  let h = 2166136261;
  for (const ch of `bunkr-daily-${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function dailyPlayed(m: Meta): boolean {
  return m.daily?.date === todayKey();
}

/** Daily Doom is a level playing field: fixed DEFCON 3, no Vault perks. */
export function runConfig(m: Meta, defcon: Defcon, daily: boolean): Partial<RunConfig> {
  if (daily) return { defcon: 3, daily: true };
  return {
    defcon,
    daily: false,
    startRamen: 50 * vaultLevel(m, 'stash'),
    extraDegen: vaultLevel(m, 'extraDegen') > 0,
    startBag: vaultLevel(m, 'startBag') > 0,
    legendLuck: vaultLevel(m, 'legendLuck') > 0,
    rocket: vaultLevel(m, 'rocket') > 0,
  };
}

export interface RunRewards {
  rf: number;
  newBest: boolean;
  unlockedDefcon: Defcon | null;
}

/** Bank a finished run. Returns what was earned, for the end screen. */
export function recordRun(m: Meta, e: Ending): RunRewards {
  const rf = Math.max(1, Math.floor(e.score / 1000) + (e.survived ? 5 : 0));
  m.rf += rf;
  m.runs++;
  const key = e.daily ? 'daily' : `defcon${e.defcon}`;
  const newBest = e.score > (m.best[key] ?? 0);
  if (newBest) m.best[key] = e.score;
  let unlockedDefcon: Defcon | null = null;
  if (e.survived) {
    m.wins++;
    if (!e.daily && e.defcon === m.unlocked && m.unlocked > 1) {
      m.unlocked = (m.unlocked - 1) as Defcon;
      unlockedDefcon = m.unlocked;
    }
  }
  if (e.daily) m.daily = { date: todayKey(), score: Math.max(e.score, m.daily?.date === todayKey() ? m.daily.score : 0) };
  saveMeta(m);
  return { rf, newBest, unlockedDefcon };
}
