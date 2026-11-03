// Progress linked to a wallet: Ramen Futures, Vault upgrades, DEFCON unlocks and bests, so a
// player gets them back on any device. Linking is a free signature; the server then hands out
// a token for saving. Kept in its own file, beside the runs, so it outlives contract redeploys.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isAddress, type Address, type Hex } from 'viem';
import { cleanMeta, linkMessage, mergeMeta, type Meta } from '../src/meta';
import { pub } from './chain';
import { DATA_FILE, SERVER_SECRET } from './env';
import { HttpError } from './runs';

const FILE = process.env.PROGRESS_FILE ?? join(dirname(DATA_FILE), 'progress.json');
const TOKEN_DAYS = 90;
/** How old a link signature can be (either way, for skewed clocks). */
const LINK_WINDOW_MS = 10 * 60_000;

interface Saved {
  meta: Meta;
  updatedAt: number;
}
let saved: Record<string, Saved> = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};

function persist(): void {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(`${FILE}.tmp`, JSON.stringify(saved));
  renameSync(`${FILE}.tmp`, FILE);
}

const sig = (body: string) => createHmac('sha256', SERVER_SECRET).update(`progress:${body}`).digest('base64url');

function issueToken(address: string): string {
  const body = `${address.toLowerCase()}.${Date.now() + TOKEN_DAYS * 86400_000}`;
  return `${body}.${sig(body)}`;
}

/** The wallet a token was issued to, or an error. */
function tokenOwner(token: unknown): string {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3) throw new HttpError(401, 'Link your wallet again.');
  const [addr, exp, mac] = parts;
  const good = Buffer.from(sig(`${addr}.${exp}`));
  const given = Buffer.from(mac);
  if (good.length !== given.length || !timingSafeEqual(good, given)) throw new HttpError(401, 'Link your wallet again.');
  if (Date.now() > Number(exp)) throw new HttpError(401, 'Your link expired. Link your wallet again.');
  return addr;
}

const reply = (addr: string, token?: string) => ({ meta: saved[addr]?.meta ?? null, updatedAt: saved[addr]?.updatedAt ?? null, ...(token ? { token } : {}) });

/** GET /progress?address=0x… : whatever this wallet has saved (progress isn't secret). */
export function getProgress(address: string | null) {
  if (!address || !isAddress(address)) throw new HttpError(400, 'Bad address.');
  return reply(address.toLowerCase());
}

/** POST /progress/link { address, issued, signature } : prove you own the wallet, get a save token. */
export async function linkProgress(body: Record<string, unknown>) {
  const { address, issued, signature } = body;
  if (typeof address !== 'string' || !isAddress(address)) throw new HttpError(400, 'Bad address.');
  if (typeof issued !== 'number' || Math.abs(Date.now() - issued) > LINK_WINDOW_MS) throw new HttpError(400, 'That signature is too old. Try again.');
  if (typeof signature !== 'string' || !signature.startsWith('0x')) throw new HttpError(400, 'Missing signature.');
  // pub.verifyMessage also handles smart-contract wallets (ERC-1271).
  const ok = await pub
    .verifyMessage({ address: address as Address, message: linkMessage(address, issued), signature: signature as Hex })
    .catch(() => false);
  if (!ok) throw new HttpError(403, 'That signature doesn\'t match the wallet.');
  const addr = address.toLowerCase();
  return reply(addr, issueToken(addr));
}

/** POST /progress { token, meta } : save, merged with what's there so an old device can't roll it back. */
export function saveProgress(body: Record<string, unknown>) {
  const addr = tokenOwner(body.token);
  const incoming = cleanMeta(body.meta);
  const cur = saved[addr]?.meta;
  saved[addr] = { meta: cur ? mergeMeta(cur, incoming) : incoming, updatedAt: Date.now() };
  persist();
  return reply(addr);
}
