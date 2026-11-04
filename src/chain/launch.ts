// The real $BUNKR, once it's launched (Urufu Labs fair launch on Robinhood Chain mainnet).
// While `address` is null, the Buy button and contract address stay hidden everywhere.
// Fill both in after launch and redeploy the site.
import type { Address } from 'viem';

export const LAUNCH: { address: Address | null; buyUrl: string | null } = {
  address: null,
  buyUrl: null,
};

export const launched = !!LAUNCH.address;
export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
