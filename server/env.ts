// Server settings, from environment variables with local-dev defaults.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Address, Hex } from 'viem';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;

export interface Deployment {
  chainId: number;
  mock: boolean;
  bunkr: Address;
  tickets: Address;
  forge: Address;
  block: number;
}

const LOCAL = 31337;
const chainId = Number(env.CHAIN_ID ?? (existsSync(join(root, 'src/chain/deployments/31337.json')) ? LOCAL : 46630));
const file = join(root, `src/chain/deployments/${chainId}.json`);
if (!existsSync(file)) throw new Error(`No deployment for chain ${chainId}: run the deploy script first (${file}).`);

export const deployment: Deployment = JSON.parse(readFileSync(file, 'utf8'));
export const isLocal = chainId === LOCAL;

export const RPC_URL = env.RPC_URL ?? (isLocal ? 'http://127.0.0.1:8545' : 'https://rpc.testnet.chain.robinhood.com');
export const PORT = Number(env.PORT ?? 8787);
export const DATA_FILE = env.DATA_FILE ?? join(root, 'server/data', `runs-${chainId}.json`);

/** Anvil account #0, which the local deploy script makes the oracle. Never used off the local chain. */
const ANVIL_DEPLOYER = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
export const ORACLE_KEY = (env.ORACLE_KEY ?? (isLocal ? ANVIL_DEPLOYER : '')) as Hex;
if (!ORACLE_KEY) throw new Error('Set ORACLE_KEY to the results oracle\'s private key.');

/** Derives every run's seed. Keep it secret, or players can pick seeds. */
export const SERVER_SECRET = env.SERVER_SECRET ?? (isLocal ? 'bunkr-local-dev-secret' : '');
if (!SERVER_SECRET) throw new Error('Set SERVER_SECRET (any long random string).');

/** A run started with forged Bags that never reports back counts as liquidated after this. */
export const ABANDON_MS = Number(env.ABANDON_HOURS ?? 3) * 3600_000;
/**
 * Fastest a player can get from one underground day to the next: 36s days at 4x speed is
 * 9s, and raid days run at full pace (24s / 4 = 6s). Day seeds come no faster than this.
 */
export const MIN_DAY_GAP_MS = Number(env.MIN_DAY_GAP_MS ?? 5000);
/** How often to look for days to settle and runs to sweep. */
export const TICK_MS = Number(env.TICK_SECONDS ?? 60) * 1000;
