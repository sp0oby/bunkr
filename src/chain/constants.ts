// Token-layer constants shared by the game and the results server. No browser or Vite APIs here.
import type { BagId } from '../sim/types';

/**
 * Token id of each Bag on BunkrForge. The first 20 must match RARITY in contracts/script/Deploy.s.sol;
 * ids 20+ are Stock Bags, sold by BunkrStockForge (STOCK_BAGS below, same order as the deploy script).
 */
export const FORGE_ORDER: BagId[] = [
  'hwnecklace', 'whitepaper', 'lambokeys', 'ledger', 'laserpointer', 'safu', 'fewunderstand', 'mrenft', 'pickaxe',
  'diamondgloves', 'inhaler', 'bearspray', 'bullhorn', 'tradewatch', 'ramenprinter', 'seedtattoo', 'hazmat',
  'moonmap', 'tuningfork', 'airdropcrate',
  'seeingstone', 'overclockgpu', 'bunkercinema', 'starshippass', 'cybertruckkeys', 'execmembership',
];

/** Stock Bags in Stonk Exchange order (token ids 20+). */
export const STOCK_BAGS: BagId[] = FORGE_ORDER.slice(20);

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

/** Burn-to-drip cosmetics: ERC-1155 on BunkrForge (ids 100+). Looks only, never gameplay. */
export type CosmeticSlot = 'bunker' | 'nuke' | 'hatch';
export interface CosmeticDef {
  id: number;
  key: string;
  slot: CosmeticSlot;
  name: string;
  desc: string;
}
export const COSMETICS: CosmeticDef[] = [
  { id: 100, key: 'gold', slot: 'bunker', name: 'Gold Bunker', desc: 'Solid gold walls. Structurally questionable. Spiritually load-bearing.' },
  { id: 101, key: 'rgb', slot: 'bunker', name: 'Gamer Bunker', desc: 'RGB on every frame. +0 FPS. +100 vibes, spiritually.' },
  { id: 102, key: 'dog', slot: 'nuke', name: 'Good Boy Nuke', desc: 'Your mushroom cloud is now a dog, in the drop and in the sky all run. He is a good boy. He is also a nuke.' },
  { id: 103, key: 'goldhatch', slot: 'hatch', name: 'Gold HATCH', desc: 'HATCH, but premium. Still mean. Now mean in gold.' },
];

/** Chance each forged Bag you carried breaks when you get liquidated. */
export const SHATTER_CHANCE = 0.35;
