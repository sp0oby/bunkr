// The player's wallet and everything the game reads from or sends to the chain.
// A tiny observable store: UI subscribes with useWallet().
import { useEffect, useState } from 'preact/hooks';
import {
  BaseError, ContractFunctionRevertedError, UserRejectedRequestError, createPublicClient, createWalletClient, custom,
  decodeEventLog, http, keccak256, numberToHex, parseSignature, toHex, type Abi, type Account, type Address, type Hash, type Hex, type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { forgeAbi, ticketsAbi, tokenAbi } from './abi';
import { DEV_KEY, FORGE_ORDER, LOADOUT_SLOTS, chain, deployment, devWalletAllowed } from './config';
import { COSMETICS, type CosmeticSlot } from './constants';
import type { BagId, RunConfig } from '../sim/types';

type Kind = 'injected' | 'dev';

export interface Recipe {
  cost: bigint;
  minTier: number;
  /** Has to be found in a verified run before it can be forged. */
  foundOnly: boolean;
}

export interface WalletState {
  status: 'off' | 'disconnected' | 'connecting' | 'connected';
  kind: Kind | null;
  address: Address | null;
  wrongChain: boolean;
  tier: number;
  balance: bigint;
  tickets: number;
  freeAvailable: boolean;
  dailyAvailable: boolean;
  pot: bigint;
  forged: Partial<Record<BagId, number>>;
  /** Cosmetics owned, by token id, and what each one costs to forge. */
  drip: Record<number, number>;
  dripCost: Record<number, bigint>;
  thresholds: bigint[];
  ticketPrice: bigint;
  /** One Daily Doom attempt, and the share of it that goes to the pot (basis points). */
  dailyFee: bigint;
  dailyPotBps: number;
  recipes: Partial<Record<BagId, Recipe>>;
  /** Label of the transaction in flight, if any. */
  busy: string | null;
  error: string | null;
  lastTx: Hash | null;
}

interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, fn: (...a: unknown[]) => void): void;
}
const injected = (): Eip1193 | undefined => (window as unknown as { ethereum?: Eip1193 }).ethereum;

const KEY = 'bunkr.wallet';
const LOADOUT_KEY = 'bunkr.loadout';
const PLAY_TIER_KEY = 'bunkr.playTier';

let state: WalletState = {
  status: deployment && chain ? 'disconnected' : 'off',
  kind: null, address: null, wrongChain: false,
  tier: 0, balance: 0n, tickets: 0, freeAvailable: false, dailyAvailable: true, pot: 0n, forged: {}, drip: {}, dripCost: {},
  thresholds: [], ticketPrice: 0n, dailyFee: 0n, dailyPotBps: 0, recipes: {},
  busy: null, error: null, lastTx: null,
};
const subs = new Set<() => void>();
function set(patch: Partial<WalletState>): void {
  state = { ...state, ...patch };
  for (const fn of subs) fn();
}
export const wallet = () => state;

export function useWallet(): WalletState {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    subs.add(fn);
    return () => void subs.delete(fn);
  }, []);
  return state;
}

const pub = chain ? createPublicClient({ chain, transport: http(), pollingInterval: 1_000 }) : null;
let client: WalletClient | null = null;
let account: Account | Address | null = null;
let listening = false;

// ------------------------------------------------------------------ connect

export async function connect(kind: Kind, silent = false): Promise<void> {
  if (!chain || !deployment) return;
  set({ status: 'connecting', error: null });
  try {
    if (kind === 'dev') {
      if (!devWalletAllowed) throw new Error('The test wallet only works on the local chain.');
      const acct = privateKeyToAccount(DEV_KEY);
      client = createWalletClient({ account: acct, chain, transport: http() });
      account = acct;
      set({ kind, address: acct.address, wrongChain: false });
    } else {
      const eth = injected();
      if (!eth) throw new Error('No wallet found. Install a browser wallet like MetaMask or Rabby.');
      const accounts = (await eth.request({ method: silent ? 'eth_accounts' : 'eth_requestAccounts' })) as Address[];
      if (!accounts.length) {
        set({ status: 'disconnected' });
        return;
      }
      client = createWalletClient({ account: accounts[0], chain, transport: custom(eth) });
      account = accounts[0];
      const id = Number(await eth.request({ method: 'eth_chainId' }));
      set({ kind, address: accounts[0], wrongChain: id !== chain.id });
      if (id !== chain.id && !silent) await switchChain();
      if (!listening) {
        listening = true;
        eth.on?.('accountsChanged', (a) => {
          if (state.kind !== 'injected') return;
          if (!(a as Address[]).length) disconnect();
          else void connect('injected', true);
        });
        eth.on?.('chainChanged', (c) => set({ wrongChain: Number(c) !== chain?.id }));
      }
    }
    try {
      localStorage.setItem(KEY, kind);
    } catch {
      /* ignore */
    }
    set({ status: 'connected' });
    await refresh();
  } catch (e) {
    set({ status: 'disconnected', address: null, kind: null, error: friendly(e) });
  }
}

/** Sign a plain text message (free, no transaction). */
export async function signText(message: string): Promise<Hex> {
  if (!client || !account) throw new Error('Connect a wallet first.');
  return client.signMessage({ account, message });
}

export async function switchChain(): Promise<void> {
  const eth = injected();
  if (!eth || !chain) return;
  const hex = numberToHex(chain.id);
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
  } catch {
    await eth.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: hex,
        chainName: chain.name,
        nativeCurrency: chain.nativeCurrency,
        rpcUrls: chain.rpcUrls.default.http,
        blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : [],
      }],
    });
  }
  set({ wrongChain: Number(await eth.request({ method: 'eth_chainId' })) !== chain.id });
}

export function disconnect(): void {
  client = null;
  account = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  set({ status: 'disconnected', kind: null, address: null, tier: 0, balance: 0n, tickets: 0, freeAvailable: false, forged: {} });
}

/** Reconnect without a popup if the player connected before. */
export async function restore(): Promise<void> {
  if (state.status === 'off') return;
  void loadConfig();
  let kind: string | null = null;
  try {
    kind = localStorage.getItem(KEY);
  } catch {
    /* ignore */
  }
  if (kind === 'dev' && devWalletAllowed) await connect('dev', true);
  else if (kind === 'injected' && injected()) await connect('injected', true);
}

// ------------------------------------------------------------------ reads

/** Tier thresholds, prices and forge recipes: the same for everyone, read once. */
let config: Promise<void> | null = null;
export function loadConfig(): Promise<void> {
  if (!pub || !deployment) return Promise.resolve();
  config ??= (async () => {
    const [thresholds, ticketPrice, dailyFee, dailyPotBps, recipes, dripRows] = await Promise.all([
      pub.readContract({ address: deployment.tickets, abi: ticketsAbi, functionName: 'getTierThresholds' }),
      pub.readContract({ address: deployment.tickets, abi: ticketsAbi, functionName: 'ticketPrice' }),
      pub.readContract({ address: deployment.tickets, abi: ticketsAbi, functionName: 'dailyFee' }),
      pub.readContract({ address: deployment.tickets, abi: ticketsAbi, functionName: 'dailyPotBps' }),
      readRecipes(),
      Promise.all(COSMETICS.map((c) => pub.readContract({ address: deployment!.forge, abi: forgeAbi, functionName: 'recipes', args: [BigInt(c.id)] }))),
    ]);
    const dripCost: Record<number, bigint> = {};
    dripRows.forEach(([cost, , enabled], i) => enabled && (dripCost[COSMETICS[i].id] = cost));
    set({ thresholds: [...thresholds], ticketPrice, dailyFee, dailyPotBps, recipes, dripCost });
  })().catch((e) => {
    config = null; // try again next time
    set({ error: friendly(e) });
  });
  return config;
}

export async function refresh(): Promise<void> {
  if (!pub || !deployment || !state.address) return;
  const who = state.address;
  try {
    const [ps, owned, dailyAvailable, dripOwned] = await Promise.all([
      pub.readContract({ address: deployment.tickets, abi: ticketsAbi, functionName: 'playerState', args: [who] }),
      pub.readContract({ address: deployment.forge, abi: forgeAbi, functionName: 'bagsOf', args: [who, FORGE_ORDER.map((_, i) => BigInt(i))] }),
      pub.readContract({ address: deployment.tickets, abi: ticketsAbi, functionName: 'dailyAvailable', args: [who] }),
      pub.readContract({ address: deployment.forge, abi: forgeAbi, functionName: 'bagsOf', args: [who, COSMETICS.map((c) => BigInt(c.id))] }),
      loadConfig(),
    ]);
    const drip: Record<number, number> = {};
    dripOwned.forEach((n, i) => n > 0n && (drip[COSMETICS[i].id] = Number(n)));
    const forged: Partial<Record<BagId, number>> = {};
    owned.forEach((n, i) => {
      if (n > 0n) forged[FORGE_ORDER[i]] = Number(n);
    });
    const [tier, balance, tickets, freeAvailable, pot] = ps;
    set({ tier, balance, tickets: Number(tickets), freeAvailable, dailyAvailable, pot, forged, drip });
  } catch (e) {
    set({ error: friendly(e) });
  }
}

async function readRecipes(): Promise<Partial<Record<BagId, Recipe>>> {
  const rows = await Promise.all(
    FORGE_ORDER.map((_, i) => pub!.readContract({ address: deployment!.forge, abi: forgeAbi, functionName: 'recipes', args: [BigInt(i)] })),
  );
  const out: Partial<Record<BagId, Recipe>> = {};
  rows.forEach(([cost, minTier, enabled, foundOnly], i) => {
    if (enabled) out[FORGE_ORDER[i]] = { cost, minTier, foundOnly };
  });
  return out;
}

// ------------------------------------------------------------------ writes

async function send(label: string, address: Address, abi: Abi, functionName: string, args: unknown[]): Promise<Hash> {
  if (!client || !pub || !account) throw new Error('Connect a wallet first.');
  if (state.wrongChain) await switchChain();
  // Simulate first so a revert shows up as a readable reason, not a failed transaction.
  const { request } = await pub.simulateContract({ address, abi, functionName, args, account } as never);
  set({ busy: label });
  const hash = await client.writeContract(request as never);
  set({ lastTx: hash });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('Transaction failed on chain.');
  return hash;
}

async function run<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  set({ busy: label, error: null });
  try {
    const out = await fn();
    await refresh();
    return out;
  } catch (e) {
    set({ error: friendly(e) });
    return null;
  } finally {
    set({ busy: null });
  }
}

/** Testnet only: free MockBUNKR once a day. */
export const faucet = () =>
  run('Claiming test $BUNKR', () => send('Claiming test $BUNKR', deployment!.bunkr, tokenAbi, 'faucet', []));

export const buyTickets = (qty: number) =>
  run(`Buying ${qty} ticket${qty > 1 ? 's' : ''}`, async () => {
    const cost = state.ticketPrice * BigInt(qty);
    const permit = await maybePermit(deployment!.tickets, cost);
    return permit
      ? send('Buying tickets', deployment!.tickets, ticketsAbi, 'buyTicketsWithPermit', [BigInt(qty), ...permit])
      : send('Buying tickets', deployment!.tickets, ticketsAbi, 'buyTickets', [BigInt(qty)]);
  });

/** Forge a Bag. Found Bags need the results server's voucher from the run they were found in. */
export const forgeBag = (bag: BagId, found?: { runId: number; voucher: Hex }) =>
  run('Forging', async () => {
    const id = BigInt(FORGE_ORDER.indexOf(bag));
    const cost = state.recipes[bag]?.cost ?? 0n;
    const permit = await maybePermit(deployment!.forge, cost);
    if (found) {
      const head = [id, BigInt(found.runId), found.voucher] as const;
      return permit
        ? send('Forging', deployment!.forge, forgeAbi, 'forgeFoundWithPermit', [...head, ...permit])
        : send('Forging', deployment!.forge, forgeAbi, 'forgeFound', [...head]);
    }
    return permit
      ? send('Forging', deployment!.forge, forgeAbi, 'forgeWithPermit', [id, ...permit])
      : send('Forging', deployment!.forge, forgeAbi, 'forge', [id]);
  });

/** Burn $BUNKR for a cosmetic. */
export const forgeDrip = (id: number) =>
  run('Forging drip', async () => {
    const cost = state.dripCost[id] ?? 0n;
    const permit = await maybePermit(deployment!.forge, cost);
    return permit
      ? send('Forging drip', deployment!.forge, forgeAbi, 'forgeWithPermit', [BigInt(id), ...permit])
      : send('Forging drip', deployment!.forge, forgeAbi, 'forge', [BigInt(id)]);
  });

// ------------------------------------------------------------------ drip (equipped cosmetics)

const DRIP_KEY = 'bunkr.drip';

/** Equipped cosmetic per slot, only if the wallet still owns it. */
export function equippedDrip(s: WalletState = state): Partial<Record<CosmeticSlot, string>> {
  let saved: Partial<Record<CosmeticSlot, number>> = {};
  try {
    saved = JSON.parse(localStorage.getItem(DRIP_KEY) ?? '{}');
  } catch {
    /* ignore */
  }
  const out: Partial<Record<CosmeticSlot, string>> = {};
  for (const [slot, id] of Object.entries(saved) as [CosmeticSlot, number][]) {
    const def = COSMETICS.find((c) => c.id === id);
    if (def && (s.drip[id] ?? 0) > 0) out[slot] = def.key;
  }
  return out;
}

export function toggleDrip(id: number): void {
  const def = COSMETICS.find((c) => c.id === id);
  if (!def) return;
  let saved: Partial<Record<CosmeticSlot, number>> = {};
  try {
    saved = JSON.parse(localStorage.getItem(DRIP_KEY) ?? '{}');
  } catch {
    /* ignore */
  }
  if (saved[def.slot] === id) delete saved[def.slot];
  else saved[def.slot] = id;
  try {
    localStorage.setItem(DRIP_KEY, JSON.stringify(saved));
  } catch {
    /* ignore */
  }
  set({});
}

/**
 * Starts a run: a normal run spends a Ration Ticket (today's free one first); Daily Doom pays
 * its entry fee into the pot. The transaction carries the hash of a fresh secret; only this
 * browser knows the secret, so only it can report the result. Forged Bags being carried are
 * then locked in the Forge until the results server settles the run.
 */
export const enterRun = (daily: boolean, bags: BagId[] = []) =>
  run(daily ? 'Paying the Daily Doom entry' : 'Spending a Ration Ticket', async () => {
    const secret = toHex(crypto.getRandomValues(new Uint8Array(32)));
    const commit = keccak256(secret);
    const permit = daily ? await maybePermit(deployment!.tickets, state.dailyFee) : null;
    const label = daily ? 'Paying the Daily Doom entry' : 'Spending a Ration Ticket';
    const hash = permit
      ? await send(label, deployment!.tickets, ticketsAbi, 'enterDailyWithPermit', [commit, ...permit])
      : await send(label, deployment!.tickets, ticketsAbi, 'enterRun', [daily, commit]);
    const receipt = await pub!.getTransactionReceipt({ hash });
    for (const log of receipt.logs) {
      try {
        const ev = decodeEventLog({ abi: ticketsAbi, data: log.data, topics: log.topics });
        if (ev.eventName !== 'RunEntered') continue;
        const runId = Number(ev.args.runId);
        return { runId, txHash: hash, secret, loadout: daily ? [] : await lockBags(runId, bags) };
      } catch {
        /* not ours */
      }
    }
    throw new Error('The ticket went through but no run was recorded.');
  });

/** Move the carried Bags into the Forge for this run. The ticket is already spent, so if the
 *  player says no (or it fails) they just play this run without them. */
async function lockBags(runId: number, bags: BagId[]): Promise<BagId[]> {
  if (!bags.length) return [];
  try {
    const ids = bags.map((b) => BigInt(FORGE_ORDER.indexOf(b)));
    await send('Locking your Bags in for this run', deployment!.forge, forgeAbi, 'lockLoadout', [BigInt(runId), ids]);
    return bags;
  } catch {
    return [];
  }
}

/**
 * One signature instead of an approve transaction. Returns null when the allowance is
 * already enough; falls back to a plain approve if the wallet can't sign typed data.
 */
async function maybePermit(spender: Address, value: bigint): Promise<[bigint, number, Hash, Hash] | null> {
  const owner = state.address!;
  const allowance = await pub!.readContract({ address: deployment!.bunkr, abi: tokenAbi, functionName: 'allowance', args: [owner, spender] });
  if (allowance >= value) return null;
  const approve = async () => {
    await send('Approving $BUNKR', deployment!.bunkr, tokenAbi, 'approve', [spender, value]);
    return null;
  };
  // Not every launchpad token has Permit: no nonces() means a plain approve.
  let name: string, version: string, nonce: bigint;
  try {
    nonce = await pub!.readContract({ address: deployment!.bunkr, abi: tokenAbi, functionName: 'nonces', args: [owner] });
    // Sign for the token's real EIP-712 domain (ERC-5267) when it publishes one.
    [name, version] = await pub!
      .readContract({ address: deployment!.bunkr, abi: tokenAbi, functionName: 'eip712Domain' })
      .then((d) => [d[1], d[2]] as [string, string])
      .catch(async () => [await pub!.readContract({ address: deployment!.bunkr, abi: tokenAbi, functionName: 'name' }), '1'] as [string, string]);
  } catch {
    return approve();
  }
  // The chain's clock, not this computer's: a skewed clock would expire the permit.
  const deadline = (await pub!.getBlock()).timestamp + 1800n;
  try {
    set({ busy: 'Sign the approval in your wallet' });
    const sig = await client!.signTypedData({
      account: account!,
      domain: { name, version, chainId: chain!.id, verifyingContract: deployment!.bunkr },
      types: {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Permit',
      message: { owner, spender, value, nonce, deadline },
    });
    const { r, s, v, yParity } = parseSignature(sig);
    return [deadline, Number(v ?? BigInt(yParity! + 27)), r, s];
  } catch (e) {
    if (rejected(e)) throw e;
    return approve();
  }
}

// ------------------------------------------------------------------ errors

function rejected(e: unknown): boolean {
  return e instanceof BaseError && !!e.walk((x) => x instanceof UserRejectedRequestError);
}

const REVERTS: Record<string, string> = {
  NoDeed: 'You need a Bunker Deed (hold at least the Shed amount of $BUNKR).',
  DailyAlreadyPlayed: 'You already played today\'s Daily Doom. One attempt per day.',
  NoTicket: 'Out of Ration Tickets. Buy more, or wait for tomorrow\'s free one.',
  TierTooLow: 'Your Deed tier is too low to forge that Bag.',
  UnknownBag: 'That Bag can\'t be forged.',
  FaucetCooldown: 'Faucet already used today. Come back tomorrow.',
  FaucetEmpty: 'The faucet is dry.',
  ERC20InsufficientBalance: 'Not enough $BUNKR.',
  ERC20InsufficientAllowance: 'The approval didn\'t go through. Try again.',
};

function friendly(e: unknown): string {
  if (rejected(e)) return 'You cancelled it in your wallet.';
  if (e instanceof BaseError) {
    const rev = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    const name = rev?.data?.errorName;
    if (name && REVERTS[name]) return REVERTS[name];
    return e.shortMessage;
  }
  return e instanceof Error ? e.message : String(e);
}

// ------------------------------------------------------------------ play tier

/**
 * The Deed a player runs with: any tier from Shed up to the one their balance holds. Unset
 * (or set to the top) follows the balance, so buying more still upgrades them on its own.
 */
export function playTier(s: WalletState = state): number {
  if (s.tier < 1) return s.tier;
  let picked = 0;
  try {
    picked = Number(localStorage.getItem(PLAY_TIER_KEY)) || 0;
  } catch {
    /* ignore */
  }
  return picked >= 1 ? Math.min(picked, s.tier) : s.tier;
}

export function setPlayTier(tier: number): void {
  try {
    if (tier >= state.tier) localStorage.removeItem(PLAY_TIER_KEY);
    else localStorage.setItem(PLAY_TIER_KEY, String(Math.max(1, tier)));
  } catch {
    /* ignore */
  }
  set({});
}

// ------------------------------------------------------------------ loadout

/** Forged Bags the player picked to bring, trimmed to what they still own and can equip. */
export function loadout(s: WalletState = state): BagId[] {
  let picked: BagId[] = [];
  try {
    picked = JSON.parse(localStorage.getItem(LOADOUT_KEY) ?? '[]');
  } catch {
    /* ignore */
  }
  return picked
    .filter((b) => (s.forged[b] ?? 0) > 0 && (s.recipes[b]?.minTier ?? 9) <= playTier(s))
    .slice(0, LOADOUT_SLOTS[playTier(s)] ?? 0);
}

export function toggleLoadout(bag: BagId): void {
  const cur = loadout();
  const next = cur.includes(bag) ? cur.filter((b) => b !== bag) : [...cur, bag].slice(-(LOADOUT_SLOTS[playTier()] || 1));
  try {
    localStorage.setItem(LOADOUT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  set({});
}

// ------------------------------------------------------------------ run pass

/** Proof the player spent a ticket, handed from the title screen to the run. */
export interface RunPass {
  runId: number;
  txHash: Hash;
  /** Reveals the run's commit to the results server. */
  secret: Hex;
  /** Filled in once the results server has handed out the seed. */
  seed?: number;
  config?: Partial<RunConfig>;
  address: Address;
  chainId: number;
  tier: number;
  loadout: BagId[];
  daily: boolean;
}
const PASS_KEY = 'bunkr.runPass';

export function savePass(p: RunPass): void {
  try {
    sessionStorage.setItem(PASS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function readPass(daily: boolean): RunPass | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(PASS_KEY) ?? 'null') as RunPass | null;
    return p && p.chainId === chain?.id && p.daily === daily ? p : null;
  } catch {
    return null;
  }
}

export function clearPass(): void {
  try {
    sessionStorage.removeItem(PASS_KEY);
  } catch {
    /* ignore */
  }
}
