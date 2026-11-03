// End to end on a local Anvil chain with the results server running (npm run server):
// tickets -> /run/start -> play -> /run/finish, a shatter, cheating attempts, and a
// Daily Doom payout after the chain's clock moves past midnight.
import { readFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, encodeAbiParameters, recoverMessageAddress, http, keccak256, parseAbi, parseAbiParameters, toBytes, toHex, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { forgeAbi, ticketsAbi, tokenAbi } from '../../src/chain/abi';
import { FORGE_ORDER, LOADOUT_SLOTS } from '../../src/chain/constants';
import { Game } from '../../src/sim/game';
import type { RunConfig } from '../../src/sim/types';

const API = 'http://localhost:8787';
const dep = JSON.parse(readFileSync(new URL('../../src/chain/deployments/31337.json', import.meta.url), 'utf8'));
const pub = createPublicClient({ chain: foundry, transport: http(), pollingInterval: 200 });
// The local deploy makes Anvil account #0 the oracle, so the test can sign its own vouchers.
const ORACLE = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
function testVoucher(player: Address, bagId: number, runId: number): Promise<Hex> {
  const digest = keccak256(encodeAbiParameters(parseAbiParameters('bytes32, uint256, address, address, uint256, uint256'), [
    keccak256(toBytes('BUNKR found Bag')), 31337n, dep.forge, player, BigInt(bagId), BigInt(runId),
  ]));
  return ORACLE.signMessage({ message: { raw: digest } });
}
// Anvil test accounts #3 and #4.
const KEYS: Hex[] = ['0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6', '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a'];

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures++;
};

async function api(path: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${API}${path}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  return { status: res.status, json: await res.json() };
}

function player(key: Hex) {
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain: foundry, transport: http() });
  const write = async (address: Address, abi: any, functionName: string, args: unknown[] = []) => {
    const { request } = await pub.simulateContract({ account, address, abi, functionName, args } as any);
    const hash = await wallet.writeContract(request as any);
    await pub.waitForTransactionReceipt({ hash });
    return hash;
  };
  return { account, write };
}

/** A lazy bot: builds nothing, so the bunker dies. Fetches each day's seed like the game does. */
async function playIdle(seed: number, config: Partial<RunConfig>, runId: number, secret: Hex) {
  const g = new Game(seed, config);
  g.skipPrep();
  for (let i = 0; i < 100_000 && !g.ending; i++) {
    if (g.card) g.card.result == null ? g.chooseCard(0) : g.dismissCard();
    if (g.audit) g.audit.done ? g.dismissAudit() : g.answerAudit(true);
    if (g.revive) g.revive.done ? g.dismissRevive() : g.pressF();
    if (g.phase === 'drop') g.skipDrop();
    const need = g.awaitingDay();
    if (need != null) {
      const r = await api('/run/day', { runId, secret, day: need });
      if (r.status === 429) await new Promise((ok) => setTimeout(ok, 300));
      else if (r.status === 200) {
        g.daySeeds.set(r.json.day, r.json.seed);
        if (r.json.event) g.dayEvents.set(r.json.day, r.json.event);
      }
      else throw new Error(`day ${need}: ${r.json.error}`);
      continue;
    }
    g.step();
  }
  return g;
}

async function enter(p: ReturnType<typeof player>, daily: boolean) {
  const secret = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const txHash = await p.write(dep.tickets, ticketsAbi, 'enterRun', [daily, keccak256(secret)]);
  return { secret, txHash };
}

const test = createWalletClient({ chain: foundry, transport: http() });
async function nextDay() {
  await test.request({ method: 'evm_increaseTime' as any, params: [86400] as any });
  await test.request({ method: 'evm_mine' as any, params: [] as any });
}

async function main() {
  const [alice, bob] = KEYS.map(player);
  await nextDay(); // a fresh UTC day, so earlier runs of this test don't collide
  for (const p of [alice, bob]) {
    await p.write(dep.bunkr, tokenAbi, 'faucet').catch(() => {});
    await p.write(dep.bunkr, tokenAbi, 'approve', [dep.tickets, 10n ** 30n]);
    await p.write(dep.bunkr, tokenAbi, 'approve', [dep.forge, 10n ** 30n]);
  }
  await alice.write(dep.tickets, ticketsAbi, 'buyTickets', [4n]); // feeds today's pot
  await bob.write(dep.tickets, ticketsAbi, 'buyTickets', [2n]);

  // --- Daily Doom for both players
  const results: Record<string, number> = {};
  for (const [name, p] of [['alice', alice], ['bob', bob]] as const) {
    const t = await enter(p, true);
    const start = await api('/run/start', { ...t, defcon: 1, vault: { startRamen: 999 }, loadout: [] });
    check(start.status === 200, `${name}: daily run started (#${start.json.runId})`);
    check(start.json.config.defcon === 3 && !start.json.config.startRamen, `${name}: daily ignores requested DEFCON and perks`);
    const again = await api('/run/start', { ...t });
    check(again.json.seed === start.json.seed, `${name}: start is idempotent`);
    check(start.json.config.serverDays === true, `${name}: underground days come from the server`);
    const g = await playIdle(start.json.seed, start.json.config, start.json.runId, t.secret);
    const wrong = await api('/run/finish', { runId: start.json.runId, secret: toHex(new Uint8Array(32)), ticks: g.tick, inputs: g.inputs });
    check(wrong.status === 403, `${name}: someone without the secret can't submit`);
    const fin = await api('/run/finish', { runId: start.json.runId, secret: t.secret, ticks: g.tick, inputs: g.inputs });
    check(fin.status === 200 && fin.json.score === g.ending!.score, `${name}: server replay matches (${fin.json.score}, ${fin.json.title})`);
    results[name] = fin.json.score;
  }
  const dupe = await enter(bob, true).then(() => false).catch(() => true);
  check(dupe, 'second Daily Doom the same day is rejected on chain');

  // --- Cheating: an input log for a run that isn't over doesn't count
  {
    const t = await enter(alice, false);
    const start = await api('/run/start', { ...t, defcon: 5, loadout: [] });
    const short = await api('/run/finish', { runId: start.json.runId, secret: t.secret, ticks: 50, inputs: [] });
    check(short.status === 400, `an unfinished run is rejected (${short.json.error})`);
    const junk = await api('/run/finish', { runId: start.json.runId, secret: t.secret, ticks: 10, inputs: [[0, 'mintMoney', []]] });
    check(junk.status === 400, 'unknown actions are rejected');

    // Looking ahead: skip a day, ask too fast, or replay with day seeds you made up.
    const skip = await api('/run/day', { runId: start.json.runId, secret: t.secret, day: 3 });
    check(skip.status === 400, `can't ask for day 3 before day 1 (${skip.json.error})`);
    const d1 = await api('/run/day', { runId: start.json.runId, secret: t.secret, day: 1 });
    const d2 = await api('/run/day', { runId: start.json.runId, secret: t.secret, day: 2 });
    check(d1.status === 200 && d2.status === 429, `day seeds are paced (${d2.json.error})`);
    const fake = new Game(start.json.seed, start.json.config);
    fake.skipPrep();
    for (let i = 0; i < 100_000 && !fake.ending; i++) {
      if (fake.card) fake.card.result == null ? fake.chooseCard(0) : fake.dismissCard();
      if (fake.audit) fake.audit.done ? fake.dismissAudit() : fake.answerAudit(true);
      if (fake.revive) fake.revive.done ? fake.dismissRevive() : fake.pressF();
      if (fake.phase === 'drop') fake.skipDrop();
      const need = fake.awaitingDay();
      if (need != null) fake.daySeeds.set(need, need === 1 ? d1.json.seed : 12345 + need);
      fake.step();
    }
    const forged = await api('/run/finish', { runId: start.json.runId, secret: t.secret, ticks: fake.tick, inputs: fake.inputs });
    check(forged.status === 400, `a run simulated past the days you were given is rejected (${forged.json.error})`);
  }

  // --- Picking a Deed: lower than you hold is fine, higher is capped.
  {
    const [held] = await pub.readContract({ address: dep.tickets, abi: ticketsAbi, functionName: 'playerState', args: [alice.account.address] });
    const high = await api('/run/start', { ...(await enter(alice, false)), defcon: 5, tier: 9 });
    check(high.json.config.deedTier === held, `asking for a higher Deed is capped at the one held (${held})`);
    const low = await api('/run/start', { ...(await enter(alice, false)), defcon: 5, tier: 1 });
    check(low.json.config.deedTier === 1, 'asking for a lower Deed plays as that Deed');
  }

  // --- Forged Bags: locked in the Forge for the run, then shattered or returned.
  {
    const bags = ['lambokeys', 'pickaxe', 'inhaler', 'mrenft'] as const; // commons: Shed tier
    const plain = await bob.write(dep.forge, forgeAbi, 'forge', [BigInt(FORGE_ORDER.indexOf(bags[0]))]).then(() => false).catch(() => true);
    check(plain, 'a Bag can\'t be forged without being found first');
    // Vouchers as if each was found in some earlier run (fresh run ids each time the test runs).
    const base = 1_000_000 + Math.floor(Date.now() / 1000) % 1_000_000;
    for (const [i, b] of bags.entries()) {
      const id = FORGE_ORDER.indexOf(b);
      await bob.write(dep.forge, forgeAbi, 'forgeFound', [BigInt(id), BigInt(base + i), await testVoucher(bob.account.address, id, base + i)]);
    }
    const [tier] = await pub.readContract({ address: dep.tickets, abi: ticketsAbi, functionName: 'playerState', args: [bob.account.address] });
    const slots = LOADOUT_SLOTS[tier];
    const carry = bags.slice(0, slots);
    const ids = carry.map((b) => BigInt(FORGE_ORDER.indexOf(b)));
    const bagsOf = () => pub.readContract({ address: dep.forge, abi: forgeAbi, functionName: 'bagsOf', args: [bob.account.address, ids] });
    const had = await bagsOf();

    const t = await enter(bob, false);
    const receipt = await pub.getTransactionReceipt({ hash: t.txHash });
    const runId = BigInt(receipt.logs.find((l) => l.address.toLowerCase() === dep.tickets.toLowerCase())!.topics[2]!);
    await bob.write(dep.forge, forgeAbi, 'lockLoadout', [runId, ids]);
    const during = await bagsOf();
    check(during.every((n, i) => n === had[i] - 1n), `carried Bags leave the wallet for the run (${carry.join(', ')})`);
    // Only the locked copy is stuck: a spare from an earlier test run can still be sent.
    const sendAll = during[0] + 1n;
    const dodge = await bob.write(dep.forge, parseAbi(['function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes data)']), 'safeTransferFrom', [bob.account.address, alice.account.address, ids[0], sendAll, '0x']).then(() => false).catch(() => true);
    check(dodge, 'a locked Bag can\'t be sent away mid-run');

    const start = await api('/run/start', { ...t, defcon: 5, loadout: ['moonmap'] });
    const lo = start.json.config.loadout as string[];
    check(JSON.stringify(lo) === JSON.stringify(carry), `loadout comes from the Forge lock, not the client (${lo.join(', ')})`);
    const g = await playIdle(start.json.seed, start.json.config, start.json.runId, t.secret);
    const fin = await api('/run/finish', { runId: start.json.runId, secret: t.secret, ticks: g.tick, inputs: g.inputs });
    check(fin.status === 200 && !fin.json.survived, `bob got liquidated (${fin.json.title})`);
    const after = await bagsOf();
    const gone = carry.filter((_, i) => after[i] === had[i] - 1n);
    const back = carry.filter((_, i) => after[i] === had[i]);
    check(gone.length + back.length === carry.length, 'every carried Bag was either shattered or returned');
    check(JSON.stringify(gone.sort()) === JSON.stringify([...fin.json.shattered].sort()), `on-chain balances match the shatter roll (shattered: ${fin.json.shattered.join(', ') || 'none'})`);
    const found = Object.entries(fin.json.vouchers ?? {}) as [string, Hex][];
    check(found.every(([b]) => !carry.includes(b as any)), `vouchers only cover Bags found in the run, not carried ones (${found.map(([b]) => b).join(', ') || 'none found'})`);
    const vabi = parseAbi(['function voucherDigest(address,uint256,uint256) view returns (bytes32)', 'function recipes(uint256) view returns (uint128,uint8,bool,bool)']);
    let signedOk = true;
    for (const [bag, v] of found) {
      const digest = await pub.readContract({ address: dep.forge, abi: vabi, functionName: 'voucherDigest', args: [bob.account.address, BigInt(FORGE_ORDER.indexOf(bag as any)), BigInt(fin.json.runId)] });
      signedOk &&= (await recoverMessageAddress({ message: { raw: digest }, signature: v })) === ORACLE.address;
    }
    check(signedOk, 'every voucher is signed by the oracle for this player, Bag and run');
    const [bobTier] = await pub.readContract({ address: dep.tickets, abi: ticketsAbi, functionName: 'playerState', args: [bob.account.address] });
    const tiers = await Promise.all(found.map(([bag]) => pub.readContract({ address: dep.forge, abi: vabi, functionName: 'recipes', args: [BigInt(FORGE_ORDER.indexOf(bag as any))] })));
    const usable = found.filter((_, i) => tiers[i][1] <= bobTier);
    if (usable.length) {
      const [b, v] = usable[0];
      const ok = await bob.write(dep.forge, forgeAbi, 'forgeFound', [BigInt(FORGE_ORDER.indexOf(b as any)), BigInt(fin.json.runId), v]).then(() => true).catch(() => false);
      check(ok, `the server's voucher forges ${b} on chain`);
      const twice = await bob.write(dep.forge, forgeAbi, 'forgeFound', [BigInt(FORGE_ORDER.indexOf(b as any)), BigInt(fin.json.runId), v]).then(() => false).catch(() => true);
      check(twice, 'the same voucher can\'t be used twice');
    }
  }

  // --- Daily payout: move the chain clock past midnight and let the server settle.
  const board = await api('/leaderboard');
  const day = board.json.day;
  const pot = BigInt(board.json.pot);
  check(board.json.top.length === 2, `leaderboard has both players (pot ${board.json.potBunkr})`);
  const winner = board.json.top[0].player as Address;
  const before = await pub.readContract({ address: dep.bunkr, abi: tokenAbi, functionName: 'balanceOf', args: [winner] });
  await nextDay();
  let settled = false;
  for (let i = 0; i < 90 && !settled; i++) { // the server settles once a minute by default
    await new Promise((r) => setTimeout(r, 1000));
    settled = await pub.readContract({ address: dep.tickets, abi: parseAbi(['function settled(uint256) view returns (bool)']), functionName: 'settled', args: [BigInt(day)] });
  }
  check(settled, `day ${day} settled by the server`);
  const after = await pub.readContract({ address: dep.bunkr, abi: tokenAbi, functionName: 'balanceOf', args: [winner] });
  check(after - before === (pot * 6000n) / 10000n, `winner got 60% of the pot (${(after - before) / 10n ** 18n} $BUNKR)`);

  console.log(failures ? `\n${failures} failure(s)` : '\nall good');
  process.exit(failures ? 1 : 0);
}

void main();
