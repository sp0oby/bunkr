// Keeps a player's progress (Ramen Futures, Vault, unlocks, bests) on their wallet through the
// results server, so it follows them to any device. Linking is one free signature; after that
// every local save is pushed, and connecting on a new device pulls and merges.
import { useEffect, useState } from 'preact/hooks';
import { cleanMeta, linkMessage, mergeMeta, onMetaSaved, sameMeta, saveMeta, type Meta } from '../meta';
import { SERVER_URL } from './server';
import { signText, wallet } from './wallet';

const KEY = 'bunkr.progressLink';

export type SyncStatus = 'off' | 'unlinked' | 'linking' | 'syncing' | 'saved' | 'error';
let status: SyncStatus = SERVER_URL ? 'unlinked' : 'off';
let lastError: string | null = null;
const subs = new Set<() => void>();
function setStatus(s: SyncStatus, err: string | null = null): void {
  status = s;
  lastError = err;
  for (const fn of subs) fn();
}

/** Re-render on sync changes. Also bumps when a pull changed the player's progress. */
export function useProgressSync(): { status: SyncStatus; error: string | null; linkedTo: string | null } {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    subs.add(fn);
    return () => void subs.delete(fn);
  }, []);
  return { status, error: lastError, linkedTo: link()?.address ?? null };
}

interface Link {
  address: string;
  token: string;
}
function link(): Link | null {
  try {
    const l = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Link | null;
    const addr = wallet().address?.toLowerCase();
    return l && addr && l.address === addr ? l : null;
  } catch {
    return null;
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
  if (!res.ok) throw new Error(json.error ?? `Progress server error ${res.status}`);
  return json as T;
}

/** Fold the wallet's copy into this browser's, then save the result both places. */
async function adopt(m: Meta, remote: unknown, token: string): Promise<boolean> {
  const local = cleanMeta(m);
  const merged = remote ? mergeMeta(local, cleanMeta(remote)) : local;
  const changed = !sameMeta(merged, local);
  if (changed) {
    Object.assign(m, merged);
    pushing = true; // this save is ours; don't echo it back through the auto-push
    saveMeta(m);
    pushing = false;
  }
  if (!remote || !sameMeta(merged, cleanMeta(remote))) await call('/progress', { token, meta: merged });
  return changed;
}

/** One free signature to keep this progress on the connected wallet. */
export async function linkWallet(m: Meta): Promise<void> {
  const address = wallet().address;
  if (!SERVER_URL || !address) return;
  setStatus('linking');
  try {
    const issued = Date.now();
    const signature = await signText(linkMessage(address, issued));
    const r = await call<{ token: string; meta: unknown }>('/progress/link', { address, issued, signature });
    localStorage.setItem(KEY, JSON.stringify({ address: address.toLowerCase(), token: r.token }));
    await adopt(m, r.meta, r.token);
    setStatus('saved');
  } catch (e) {
    const msg = (e as Error).message ?? '';
    setStatus('unlinked', /reject|denied|cancel/i.test(msg) ? null : msg);
  }
}

/** On connect: if this wallet is linked here, pull its progress and merge. */
export async function pullProgress(m: Meta): Promise<void> {
  const l = link();
  if (!SERVER_URL) return;
  if (!l) return setStatus('unlinked');
  setStatus('syncing');
  try {
    const r = await call<{ meta: unknown }>(`/progress?address=${l.address}`);
    await adopt(m, r.meta, l.token);
    setStatus('saved');
  } catch (e) {
    setStatus(link() ? 'error' : 'unlinked', (e as Error).message);
  }
}

// Every local save goes to the wallet too (debounced: a run end and a Vault buy can land together).
let pushing = false;
let timer: ReturnType<typeof setTimeout> | null = null;
onMetaSaved((m) => {
  if (pushing || !SERVER_URL) return;
  const l = link();
  if (!l) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    setStatus('syncing');
    call('/progress', { token: l.token, meta: cleanMeta(m) })
      .then(() => setStatus('saved'))
      .catch((e) => setStatus(link() ? 'error' : 'unlinked', (e as Error).message));
  }, 800);
});
