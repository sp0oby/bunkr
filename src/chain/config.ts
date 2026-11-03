// Which chain the game talks to, and where our contracts live on it.
// Addresses come from contracts/script/Deploy.s.sol, which writes
// src/chain/deployments/<chainId>.json.
import { defineChain, type Address, type Chain } from 'viem';
import { foundry } from 'viem/chains';
export { FORGE_ORDER, LOADOUT_SLOTS, TIERS, TIER_PERKS } from './constants';

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

export function explorerTx(hash: string): string | null {
  const url = chain?.blockExplorers?.default.url;
  return url ? `${url}/tx/${hash}` : null;
}
