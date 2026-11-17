// Achievements. Each one is read off a finished run, so the browser and the results
// server (which replays the run) always agree on what a run earned.
import { isStockBag } from './content';
import type { Game } from './game';

export type AchId =
  | 'gm' | 'ngmi' | 'touchgrass' | 'diamondhands' | 'doomscroller' | 'tentlife'
  | 'dao' | 'laststanding' | 'baron' | 'whale' | 'moon' | 'raiders'
  | 'exit' | 'rug' | 'audit' | 'pressf' | 'paperhands' | 'nocasualties'
  | 'undefeated' | 'stonks';

export interface Achievement {
  id: AchId;
  name: string;
  /** How to earn it. */
  desc: string;
  /** Hidden until earned: the name shows, the how stays a secret. */
  secret?: boolean;
  earned: (g: Game) => boolean;
}

const won = (g: Game) => !!g.ending?.survived;
const titled = (t: string) => (g: Game) => g.ending?.title === t;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'gm', name: 'gm', desc: 'Finish your first run.', earned: (g) => !!g.ending },
  { id: 'ngmi', name: 'ngmi', desc: 'Get liquidated before day 3.', earned: (g) => g.ending?.title === 'LIQUIDATED' && g.day < 3 },
  { id: 'tentlife', name: 'Tent Life', desc: 'Ride out the free demo in a tent.', earned: (g) => !!g.ending?.tent },
  { id: 'touchgrass', name: 'Touched Grass', desc: 'Survive all 30 days.', earned: won },
  { id: 'doomscroller', name: 'Doomscroller', desc: 'Survive a Daily Doom.', earned: (g) => won(g) && g.config.daily },
  { id: 'diamondhands', name: 'Diamond Hands', desc: 'Survive at DEFCON 1.', earned: (g) => won(g) && g.config.defcon === 1 },
  { id: 'nocasualties', name: 'No Degen Left Behind', desc: 'Survive without a single death.', earned: (g) => won(g) && g.stats.deaths === 0 },
  { id: 'undefeated', name: 'Fortress', desc: 'Survive without losing a raid.', earned: (g) => won(g) && g.stats.raidsWon > 0 && g.stats.raidsLost === 0 },
  { id: 'dao', name: 'Bunker DAO', desc: 'Surface with 8 or more degens.', earned: titled('BUNKER DAO') },
  { id: 'laststanding', name: 'Last Degens Standing', desc: 'Surface with 2 degens or fewer.', earned: titled('LAST DEGENS STANDING') },
  { id: 'baron', name: 'Ramen Baron', desc: 'Surface with 400 ramen or more.', earned: titled('RAMEN BARON') },
  { id: 'whale', name: 'Whale Hunter', desc: 'Slay the Mutant Whale.', earned: (g) => g.stats.whaleSlain },
  { id: 'audit', name: 'Clean Books', desc: 'Pass the S.E.C. audit.', earned: (g) => g.stats.auditsPassed > 0 },
  { id: 'pressf', name: 'Press F', desc: 'Bring a degen back from the dead.', earned: (g) => g.stats.revives > 0 },
  { id: 'paperhands', name: 'Paper Hands', desc: 'Have 3 degens rage-quit in one run.', earned: (g) => g.stats.quits >= 3 },
  { id: 'raiders', name: 'Became the Raiders', desc: 'Raid 3 other bunkers and surface.', earned: titled('BECAME THE RAIDERS') },
  { id: 'stonks', name: 'Stonks', desc: 'Surface holding a Stock Bag.', earned: (g) => won(g) && g.bags.some(isStockBag) },
  { id: 'moon', name: 'Literally to the Moon', desc: 'Launch the rocket.', secret: true, earned: (g) => g.stats.launched },
  { id: 'exit', name: 'Exit Liquidity', desc: 'Sell the bunker to the raiders.', secret: true, earned: titled('EXIT LIQUIDITY') },
  { id: 'rug', name: 'Dev Is Not Doing Something', desc: 'Rug your own bunker.', secret: true, earned: titled('RUGGED YOUR OWN BUNKER') },
];

export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a])) as Record<AchId, Achievement>;
export const isAchId = (v: unknown): v is AchId => typeof v === 'string' && v in ACH_BY_ID;

/** Everything a finished run earned. Empty if the run hasn't ended. */
export function earnedBy(g: Game): AchId[] {
  return g.ending ? ACHIEVEMENTS.filter((a) => a.earned(g)).map((a) => a.id) : [];
}
