// Reading the game contracts, and the oracle's transactions.
import {
  createPublicClient, createWalletClient, decodeEventLog, defineChain, encodeAbiParameters, http, keccak256, parseAbi, parseAbiParameters, toBytes,
  type Address, type Hash, type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { forgeAbi, ticketsAbi } from '../src/chain/abi';
import { FORGE_ORDER, STOCK_BAGS } from '../src/chain/constants';
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

/** What tier each forged Bag needs. */
export async function bagTiers(): Promise<Map<BagId, number>> {
  const recipes = await Promise.all(
    FORGE_ORDER.map((_, i) => pub.readContract({ address: deployment.forge, abi: forgeAbi, functionName: 'recipes', args: [BigInt(i)] })),
  );
  const minTier = new Map<BagId, number>();
  recipes.forEach(([, tier, enabled], i) => enabled && minTier.set(FORGE_ORDER[i], tier));
  // Stock Bags have no Forge recipe (they're bought, not forged): their Deed tier is on the listing.
  const sf = deployment.stockForge;
  if (sf) {
    const listings = await Promise.all(STOCK_BAGS.map((b) =>
      pub.readContract({ address: sf, abi: stockAbi, functionName: 'listings', args: [BigInt(FORGE_ORDER.indexOf(b))] })));
    listings.forEach((l, i) => l[0] !== '0x0000000000000000000000000000000000000000' && minTier.set(STOCK_BAGS[i], l[5]));
  }
  return minTier;
}

/** The Stonk Exchange's side for the oracle: weekly Stonk Pot payouts. */
const stockAbi = parseAbi([
  'function listings(uint256 id) view returns (address stock, uint128 price, uint128 burn, uint32 cap, uint32 sold, uint8 minTier, bool enabled)',
  'function week() view returns (uint256)',
  'function weekSettled(uint256 wk) view returns (bool)',
  'function potOf(uint256 wk) view returns (address[] tokens, uint256[] amounts)',
  'function settleWeek(uint256 wk, address[] winners, uint16[] shareBps)',
  'function rollWeek(uint256 wk)',
  'error NotOracle()',
  'error WeekNotOver()',
  'error AlreadySettled()',
  'error BadShares()',
]);

export const stockWeek = (sf: Address) => pub.readContract({ address: sf, abi: stockAbi, functionName: 'week' }).then(Number);
export const weekIsSettled = (sf: Address, wk: number) =>
  pub.readContract({ address: sf, abi: stockAbi, functionName: 'weekSettled', args: [BigInt(wk)] });
export async function stonkPotOf(sf: Address, wk: number): Promise<{ token: Address; amount: bigint }[]> {
  const [tokens, amounts] = await pub.readContract({ address: sf, abi: stockAbi, functionName: 'potOf', args: [BigInt(wk)] });
  return tokens.map((token, i) => ({ token, amount: amounts[i] })).filter((x) => x.amount > 0n);
}
export async function settleWeek(sf: Address, wk: number, winners: Address[], shareBps: number[]): Promise<Hash> {
  const { request } = await pub.simulateContract({
    account: oracle, address: sf, abi: stockAbi, functionName: 'settleWeek', args: [BigInt(wk), winners, shareBps],
  });
  return sendAndWait(request);
}
export async function rollWeek(sf: Address, wk: number): Promise<Hash> {
  const { request } = await pub.simulateContract({ account: oracle, address: sf, abi: stockAbi, functionName: 'rollWeek', args: [BigInt(wk)] });
  return sendAndWait(request);
}

/** The Bags a run's player locked into the Forge for it (empty if none). */
export async function lockedBags(runId: number): Promise<{ player: Address; settled: boolean; bags: BagId[] }> {
  const [player, , settled, ids] = await pub.readContract({ address: deployment.forge, abi: oracleAbi, functionName: 'lockOf', args: [BigInt(runId)] });
  return { player, settled, bags: ids.map((id) => FORGE_ORDER[Number(id)]).filter((b): b is BagId => !!b) };
}

/** The oracle's side of the game contracts. */
const oracleAbi = parseAbi([
  'function pot(uint256 day) view returns (uint256)',
  'function settled(uint256 day) view returns (bool)',
  'function settleDay(uint256 day, address[] winners, uint16[] shareBps)',
  'function rollDay(uint256 day)',
  'function lockOf(uint256 runId) view returns (address player, uint64 lockedAt, bool settled, uint256[] ids)',
  'function settleRun(uint256 runId, uint256[] shatterIds)',
  'error NotOracle()',
  'error DayNotOver()',
  'error AlreadySettled()',
  'error BadShares()',
  'error NoLock()',
  'error NotInLoadout()',
  'error BadLoadout()',
  'error ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 tokenId)',
]);

export async function deployDay(): Promise<number> {
  const block = await pub.getBlock({ blockNumber: BigInt(deployment.block) });
  return Number(block.timestamp / 86400n);
}

export async function chainToday(): Promise<number> {
  return Number((await chainNow()) / 86400n);
}

/** The chain's clock (seconds). Days and pots follow this, not the server's clock. */
export async function chainNow(): Promise<bigint> {
  return (await pub.getBlock()).timestamp;
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

/**
 * The oracle's voucher that `player` found `bag` in verified run `runId`: an Ethereum
 * signed message over the Forge's voucherDigest, which forgeFound checks on chain.
 */
export async function signVoucher(player: Address, bag: BagId, runId: number): Promise<Hex> {
  const digest = keccak256(
    encodeAbiParameters(parseAbiParameters('bytes32, uint256, address, address, uint256, uint256'), [
      keccak256(toBytes('BUNKR found Bag')), BigInt(deployment.chainId), deployment.forge, player, BigInt(FORGE_ORDER.indexOf(bag)), BigInt(runId),
    ]),
  );
  return oracle.signMessage({ message: { raw: digest } });
}

/** Close a run's lock: burn the shattered Bags, give the rest back. */
export async function settleRun(runId: number, shattered: BagId[]): Promise<Hash> {
  const { request } = await pub.simulateContract({
    account: oracle, address: deployment.forge, abi: oracleAbi, functionName: 'settleRun',
    args: [BigInt(runId), shattered.map((b) => BigInt(FORGE_ORDER.indexOf(b)))],
  });
  return sendAndWait(request);
}
