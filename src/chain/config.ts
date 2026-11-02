// Which chain the game talks to, and where our contracts live on it.
// Addresses come from contracts/script/Deploy.s.sol, which writes
// src/chain/deployments/<chainId>.json.
import { defineChain, type Address, type Chain } from 'viem';
import { foundry } from 'viem/chains';
import type { BagId } from '../sim/types';

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://explorer.testnet.chain.robinhood.com' } },
  testnet: true,
});

const CHAINS: Record<number, Chain> = { [foundry.id]: foundry, [robinhoodTestnet.id]: robinhoodTestnet };

export interface Deployment {
  chainId: number;
  /** MockBUNKR with a faucet (testnets only). */
  mock: boolean;
  bunkr: Address;
  tickets: Address;
  forge: Address;
}

const files = import.meta.glob<Deployment>('./deployments/*.json', { eager: true, import: 'default' });
const deployments = new Map(Object.values(files).map((d) => [d.chainId, d]));

/** VITE_BUNKR_CHAIN picks a chain; otherwise local Anvil in dev, then the testnet. */
function pick(): Deployment | null {
  const wanted = Number(import.meta.env.VITE_BUNKR_CHAIN);
  if (wanted) return deployments.get(wanted) ?? null;
  if (import.meta.env.DEV && deployments.has(foundry.id)) return deployments.get(foundry.id)!;
  return deployments.get(robinhoodTestnet.id) ?? null;
}

/** null = no contracts for this build: the token layer is off and everyone plays the full game. */
export const deployment = pick();
export const chain: Chain | null = deployment ? CHAINS[deployment.chainId] ?? null : null;
export const tokenGate = !!(deployment && chain);

/** Anvil's well-known test account #1. Only offered on the local chain. */
export const DEV_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const;
export const devWalletAllowed = chain?.id === foundry.id;

/** Token id of each Bag on BunkrForge. Must match RARITY in contracts/script/Deploy.s.sol. */
export const FORGE_ORDER: BagId[] = [
  'hwnecklace', 'whitepaper', 'lambokeys', 'ledger', 'laserpointer', 'safu', 'fewunderstand', 'mrenft', 'pickaxe',
  'diamondgloves', 'inhaler', 'bearspray', 'bullhorn', 'tradewatch', 'ramenprinter', 'seedtattoo', 'hazmat',
  'moonmap', 'tuningfork', 'airdropcrate',
];

export const TIERS = ['TENT', 'SHED', 'BASEMENT', 'BUNKER', 'SILO'] as const;
export const TIER_PERKS = [
  'Free demo. The tent gives out after 3 days.',
  'The full 30-day game. 1 free run a day. Forge common Bags.',
  '+1 Bag slot before Bagholder. Forge rare Bags. Bring 2 forged Bags.',
  'Rocket Room blueprints. Forge legendary Bags. Bring 3 forged Bags.',
  'Everything, a gold nameplate, and HATCH respects you.',
];
/** How many forged Bags each tier can bring into a run. */
export const LOADOUT_SLOTS = [0, 1, 2, 3, 3];

export function explorerTx(hash: string): string | null {
  const url = chain?.blockExplorers?.default.url;
  return url ? `${url}/tx/${hash}` : null;
}
