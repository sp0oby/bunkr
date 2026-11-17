// Achievements this browser has seen, kept apart from Meta so wallet sync stays simple.
// Ticketed runs are also checked by the results server, which is what shows as verified.
import { isAchId, type AchId } from './sim/achievements';

const KEY = 'bunkr.ach.v1';

/** Achievement id -> when this browser first earned it (ms). */
export type AchLog = Partial<Record<AchId, number>>;

export function loadAch(): AchLog {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    const out: AchLog = {};
    for (const [k, v] of Object.entries(raw)) if (isAchId(k) && typeof v === 'number') out[k] = v;
    return out;
  } catch {
    return {};
  }
}

/** Bank a run's achievements. Returns the ones that are new to this browser. */
export function recordAch(ids: AchId[], now = Date.now()): AchId[] {
  const log = loadAch();
  const fresh = ids.filter((id) => log[id] == null);
  if (!fresh.length) return [];
  for (const id of fresh) log[id] = now;
  try {
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    /* storage unavailable: they still show on this end screen */
  }
  return fresh;
}
