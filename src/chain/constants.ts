// Token-layer constants shared by the game and the results server. No browser or Vite APIs here.
import type { BagId } from '../sim/types';

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

/** Chance each forged Bag you carried breaks when you get liquidated. */
export const SHATTER_CHANCE = 0.35;
