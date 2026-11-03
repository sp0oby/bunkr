// Reading the game contracts, and the oracle's transactions.
import { createPublicClient, createWalletClient, decodeEventLog, defineChain, http, parseAbi, type Address, type Hash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { forgeAbi, ticketsAbi } from '../src/chain/abi';
import { FORGE_ORDER } from '../src/chain/constants';
import type { BagId } from '../src/sim/types';
import { ORACLE_KEY, RPC_URL, deployment } from './env';

const chain = defineChain({
  id: deployment.chainId,
  name: `chain-${deployment.chainId}`,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

export const pub = createPublicClient({ chain, transport: http(RPC_URL), pollingInterval: 1_000 });
export const oracle = privateKeyToAccount(ORACLE_KEY);
const wallet = createWalletClient({ account: oracle, chain, transport: http(RPC_URL) });

export interface RunEntry {
  player: Address;
  runId: number;
  day: number;
  daily: boolean;
  free: boolean;
  tier: number;
  commit: `0x${string}`;
}

/** The RunEntered event from the ticket transaction, straight from the chain. */
export async function runFromTx(hash: Hash): Promise<RunEntry | null> {
  const receipt = await pub.getTransactionReceipt({ hash });
  if (receipt.status !== 'success') return null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== deployment.tickets.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: ticketsAbi, data: log.data, topics: log.topics });
      if (ev.eventName !== 'RunEntered') continue;
      const a = ev.args;
      return { player: a.player, runId: Number(a.runId), day: Number(a.day), daily: a.daily, free: a.free, tier: a.tier, commit: a.commit };
    } catch {
      /* some other event */
    }
  }
  return null;
}

/** Forged Bags a player owns right now, and what tier each needs. */
export async function ownedBags(player: Address): Promise<{ owned: Set<BagId>; minTier: Map<BagId, number> }> {
  const ids = FORGE_ORDER.map((_, i) => BigInt(i));
  const [balances, recipes] = await Promise.all([
    pub.readContract({ address: deployment.forge, abi: forgeAbi, functionName: 'bagsOf', args: [player, ids] }),
    Promise.all(ids.map((id) => pub.readContract({ address: deployment.forge, abi: forgeAbi, functionName: 'recipes', args: [id] }))),
  ]);
  const owned = new Set<BagId>();
  const minTier = new Map<BagId, number>();
  balances.forEach((n, i) => n > 0n && owned.add(FORGE_ORDER[i]));
  recipes.forEach(([, tier, enabled], i) => enabled && minTier.set(FORGE_ORDER[i], tier));
  return { owned, minTier };
}

/** The oracle's side of the game contracts. */
const oracleAbi = parseAbi([
  'function pot(uint256 day) view returns (uint256)',
  'function settled(uint256 day) view returns (bool)',
  'function settleDay(uint256 day, address[] winners, uint16[] shareBps)',
  'function rollDay(uint256 day)',
  'function shatter(address player, uint256 bagId, uint256 runId)',
  'error NotOracle()',
  'error DayNotOver()',
  'error AlreadySettled()',
  'error BadShares()',
  'error AlreadyShattered()',
  'error ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 tokenId)',
]);

export async function deployDay(): Promise<number> {
  const block = await pub.getBlock({ blockNumber: BigInt(deployment.block) });
  return Number(block.timestamp / 86400n);
}

export async function chainToday(): Promise<number> {
  const block = await pub.getBlock();
  return Number(block.timestamp / 86400n);
}

export const potOf = (day: number) =>
  pub.readContract({ address: deployment.tickets, abi: oracleAbi, functionName: 'pot', args: [BigInt(day)] });
export const isSettled = (day: number) =>
  pub.readContract({ address: deployment.tickets, abi: oracleAbi, functionName: 'settled', args: [BigInt(day)] });

async function sendAndWait(request: Parameters<typeof wallet.writeContract>[0]): Promise<Hash> {
  const hash = await wallet.writeContract(request);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`Oracle transaction ${hash} reverted`);
  return hash;
}

export async function settleDay(day: number, winners: Address[], shareBps: number[]): Promise<Hash> {
  const { request } = await pub.simulateContract({
    account: oracle, address: deployment.tickets, abi: oracleAbi, functionName: 'settleDay', args: [BigInt(day), winners, shareBps],
  });
  return sendAndWait(request);
}

export async function rollDay(day: number): Promise<Hash> {
  const { request } = await pub.simulateContract({
    account: oracle, address: deployment.tickets, abi: oracleAbi, functionName: 'rollDay', args: [BigInt(day)],
  });
  return sendAndWait(request);
}

export async function shatter(player: Address, bag: BagId, runId: number): Promise<Hash> {
  const { request } = await pub.simulateContract({
    account: oracle, address: deployment.forge, abi: oracleAbi, functionName: 'shatter', args: [player, BigInt(FORGE_ORDER.indexOf(bag)), BigInt(runId)],
  });
  return sendAndWait(request);
}
