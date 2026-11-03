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
import type { BagId, RunConfig } from '../sim/types';

type Kind = 'injected' | 'dev';

export interface Recipe {
  cost: bigint;
  minTier: number;
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
  thresholds: bigint[];
  ticketPrice: bigint;
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

let state: WalletState = {
  status: deployment && chain ? 'disconnected' : 'off',
  kind: null, address: null, wrongChain: false,
  tier: 0, balance: 0n, tickets: 0, freeAvailable: false, dailyAvailable: true, pot: 0n, forged: {},
  thresholds: [], ticketPrice: 0n, recipes: {},
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

/** Tier thresholds, ticket price and forge recipes: the same for everyone, read once. */
let config: Promise<void> | null = null;
export function loadConfig(): Promise<void> {
  if (!pub || !deployment) return Promise.resolve();
  config ??= (async () => {
    const [thresholds, ticketPrice, recipes] = await Promise.all([
      pub.readContract({ address: deployment.tickets, abi: ticketsAbi, functionName: 'getTierThresholds' }),
      pub.readContract({ address: deployment.tickets, abi: ticketsAbi, functionName: 'ticketPrice' }),
      readRecipes(),
    ]);
    set({ thresholds: [...thresholds], ticketPrice, recipes });
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
    const [ps, owned, dailyAvailable] = await Promise.all([
      pub.readContract({ address: deployment.tickets, abi: ticketsAbi, functionName: 'playerState', args: [who] }),
      pub.readContract({ address: deployment.forge, abi: forgeAbi, functionName: 'bagsOf', args: [who, FORGE_ORDER.map((_, i) => BigInt(i))] }),
      pub.readContract({ address: deployment.tickets, abi: ticketsAbi, functionName: 'dailyAvailable', args: [who] }),
      loadConfig(),
    ]);
    const forged: Partial<Record<BagId, number>> = {};
    owned.forEach((n, i) => {
      if (n > 0n) forged[FORGE_ORDER[i]] = Number(n);
    });
    const [tier, balance, tickets, freeAvailable, pot] = ps;
    set({ tier, balance, tickets: Number(tickets), freeAvailable, dailyAvailable, pot, forged });
  } catch (e) {
    set({ error: friendly(e) });
  }
}

async function readRecipes(): Promise<Partial<Record<BagId, Recipe>>> {
  const rows = await Promise.all(
    FORGE_ORDER.map((_, i) => pub!.readContract({ address: deployment!.forge, abi: forgeAbi, functionName: 'recipes', args: [BigInt(i)] })),
  );
  const out: Partial<Record<BagId, Recipe>> = {};
  rows.forEach(([cost, minTier, enabled], i) => {
    if (enabled) out[FORGE_ORDER[i]] = { cost, minTier };
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

export const forgeBag = (bag: BagId) =>
  run('Forging', async () => {
    const id = BigInt(FORGE_ORDER.indexOf(bag));
    const cost = state.recipes[bag]?.cost ?? 0n;
    const permit = await maybePermit(deployment!.forge, cost);
    return permit
      ? send('Forging', deployment!.forge, forgeAbi, 'forgeWithPermit', [id, ...permit])
      : send('Forging', deployment!.forge, forgeAbi, 'forge', [id]);
  });

/**
 * Spends a Ration Ticket (today's free one first). The transaction carries the hash of a
 * fresh secret; only this browser knows the secret, so only it can report the result.
 */
export const enterRun = (daily: boolean) =>
  run('Spending a Ration Ticket', async () => {
    const secret = toHex(crypto.getRandomValues(new Uint8Array(32)));
    const hash = await send('Spending a Ration Ticket', deployment!.tickets, ticketsAbi, 'enterRun', [daily, keccak256(secret)]);
    const receipt = await pub!.getTransactionReceipt({ hash });
    for (const log of receipt.logs) {
      try {
        const ev = decodeEventLog({ abi: ticketsAbi, data: log.data, topics: log.topics });
        if (ev.eventName === 'RunEntered') return { runId: Number(ev.args.runId), txHash: hash, secret };
      } catch {
        /* not ours */
      }
    }
    throw new Error('The ticket went through but no run was recorded.');
  });

/**
 * One signature instead of an approve transaction. Returns null when the allowance is
 * already enough; falls back to a plain approve if the wallet can't sign typed data.
 */
async function maybePermit(spender: Address, value: bigint): Promise<[bigint, number, Hash, Hash] | null> {
  const owner = state.address!;
  const allowance = await pub!.readContract({ address: deployment!.bunkr, abi: tokenAbi, functionName: 'allowance', args: [owner, spender] });
  if (allowance >= value) return null;
  const [name, nonce] = await Promise.all([
    pub!.readContract({ address: deployment!.bunkr, abi: tokenAbi, functionName: 'name' }),
    pub!.readContract({ address: deployment!.bunkr, abi: tokenAbi, functionName: 'nonces', args: [owner] }),
  ]);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
  try {
    set({ busy: 'Sign the approval in your wallet' });
    const sig = await client!.signTypedData({
      account: account!,
      domain: { name, version: '1', chainId: chain!.id, verifyingContract: deployment!.bunkr },
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
    await send('Approving $BUNKR', deployment!.bunkr, tokenAbi, 'approve', [spender, value]);
    return null;
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
    .filter((b) => (s.forged[b] ?? 0) > 0 && (s.recipes[b]?.minTier ?? 9) <= s.tier)
    .slice(0, LOADOUT_SLOTS[s.tier] ?? 0);
}

export function toggleLoadout(bag: BagId): void {
  const cur = loadout();
  const next = cur.includes(bag) ? cur.filter((b) => b !== bag) : [...cur, bag].slice(-(LOADOUT_SLOTS[state.tier] || 1));
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
