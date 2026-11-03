// Talking to the results server, which hands out run seeds and verifies results by replay.
import type { Input } from '../sim/game';
import type { BagId, RunConfig } from '../sim/types';

export const SERVER_URL: string = import.meta.env.VITE_BUNKR_SERVER ?? (import.meta.env.DEV ? 'http://localhost:8787' : '');

async function post<T>(path: string, body: unknown): Promise<T> {
  if (!SERVER_URL) throw new Error('No results server configured (VITE_BUNKR_SERVER).');
  let res: Response;
  try {
    res = await fetch(`${SERVER_URL}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('Can\'t reach the results server.');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Results server error ${res.status}`);
  return json as T;
}

export interface StartReply {
  runId: number;
  seed: number;
  config: Partial<RunConfig>;
}

export const serverStart = (body: { txHash: string; secret: string; defcon: number; vault: Partial<RunConfig>; loadout: BagId[] }) =>
  post<StartReply>('/run/start', body);

export const serverDay = (body: { runId: number; secret: string; day: number }) =>
  post<{ day: number; seed: number }>('/run/day', body);

export interface FinishReply {
  runId: number;
  score: number;
  title: string;
  survived: boolean;
  verified: true;
  shattered: BagId[];
  dailyRank: number | null;
}

export const serverFinish = (body: { runId: number; secret: string; ticks: number; inputs: Input[] }) =>
  post<FinishReply>('/run/finish', body);

export interface Board {
  day: number;
  potBunkr: string;
  top: { rank: number; player: string; score: number; title: string }[];
}

export async function fetchBoard(): Promise<Board | null> {
  if (!SERVER_URL) return null;
  try {
    const res = await fetch(`${SERVER_URL}/leaderboard`);
    return res.ok ? ((await res.json()) as Board) : null;
  } catch {
    return null;
  }
}
