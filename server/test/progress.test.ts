// Wallet-linked progress against a running results server (npm run server):
// link with a signature, save, read back, and the merge and safety rules.
// Run: npx tsx server/test/progress.test.ts
import { privateKeyToAccount } from 'viem/accounts';
import { linkMessage, mergeMeta, freshMeta } from '../../src/meta';

const API = process.env.API ?? 'http://localhost:8787';
// Anvil test accounts #5 and #6 (public test keys).
const alice = privateKeyToAccount('0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba');
const mallory = privateKeyToAccount('0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e');

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures++;
};
async function api(path: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${API}${path}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  return { status: res.status, json: await res.json() };
}
async function link(who = alice, issued = Date.now(), signer = who) {
  const signature = await signer.signMessage({ message: linkMessage(who.address, issued) });
  return api('/progress/link', { address: who.address, issued, signature });
}

async function main() {
  // Merge rules (pure).
  const a = { ...freshMeta(), rf: 40, runs: 10, wins: 2, unlocked: 4 as const, vault: { stash: 1 }, best: { defcon5: 3000 } };
  const b = { ...freshMeta(), rf: 90, runs: 6, wins: 3, unlocked: 3 as const, vault: { rocket: 1 }, best: { defcon5: 2000, defcon4: 1500 } };
  const m = mergeMeta(a, b);
  check(m.rf === 40 && m.runs === 10, 'Ramen Futures come from the copy with more runs');
  check(m.unlocked === 3 && m.wins === 3 && m.vault.stash === 1 && m.vault.rocket === 1, 'unlocks, wins and upgrades keep the best of both');
  check(m.best.defcon5 === 3000 && m.best.defcon4 === 1500, 'best scores keep the higher of each');

  // Linking.
  const stolen = await link(alice, Date.now(), mallory);
  check(stolen.status === 403, 'someone else\'s signature can\'t link your wallet');
  const stale = await link(alice, Date.now() - 60 * 60_000);
  check(stale.status === 400, 'an hour-old signature is refused');
  const ok = await link();
  check(ok.status === 200 && typeof ok.json.token === 'string', 'a fresh signature links and returns a save token');
  const token = ok.json.token as string;

  // Saving and reading back.
  const save = await api('/progress', { token, meta: { ...a, rf: 1e12, unlocked: 0, vault: { stash: 99, fake: 3 } } });
  check(save.status === 200 && save.json.meta.rf === 10_000_000, 'absurd numbers are clamped');
  check(save.json.meta.vault.stash === 3 && !('fake' in save.json.meta.vault) && save.json.meta.unlocked === 1, 'only real upgrades and levels are kept');
  const older = await api('/progress', { token, meta: { ...freshMeta(), runs: 1, rf: 5 } });
  check(older.json.meta.runs === 10 && older.json.meta.vault.stash === 3, 'an older device can\'t roll progress back');
  const read = await api(`/progress?address=${alice.address}`);
  check(read.status === 200 && read.json.meta.runs === 10, 'progress reads back by wallet address');

  // Tokens.
  const forged = await api('/progress', { token: token.replace(alice.address.toLowerCase(), mallory.address.toLowerCase()), meta: a });
  check(forged.status === 401, 'a token can\'t be edited to save to another wallet');
  const none = await api(`/progress?address=${mallory.address}`);
  check(none.status === 200 && none.json.meta === null, 'a wallet with nothing saved reads back empty');

  console.log(failures ? `\n${failures} failure(s)` : '\nall good');
  process.exit(failures ? 1 : 0);
}
void main();
