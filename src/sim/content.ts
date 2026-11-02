import type { ArchId, BagId, HatchMood, ResKey, RoomType, StatKey } from './types';

// ---------- Tuning ----------
export const DAY_SECONDS = 24;
export const RUN_DAYS = 30;
export const PREP_SECONDS = 75;
export const DROP_SECONDS = 5;
export const COLS = 6;
export const MAX_FLOORS = 6;
export const POP_CAP = 14;
export const BAG_SOFT_CAP = 5;

export const BASE_CAPS: Record<ResKey, number> = { ramen: 220, water: 160, power: 120, copium: 60 };

// ---------- Rooms ----------
export interface RoomDef {
  id: RoomType;
  name: string;
  short: string;
  color: number;
  cost: number;
  stat: StatKey | null;
  desc: string;
}

export const ROOMS: Record<RoomType, RoomDef> = {
  reactor: { id: 'reactor', name: 'Hopium Reactor', short: 'REACTOR', color: 0x5bff3c, cost: 40, stat: 'grind', desc: 'Makes power. Runs on belief.' },
  kitchen: { id: 'kitchen', name: 'Ramen Kitchen', short: 'KITCHEN', color: 0xffb347, cost: 35, stat: 'grind', desc: 'Makes ramen. Ramen is food. Ramen is money.' },
  pool: { id: 'pool', name: 'Liquidity Pool', short: 'POOL', color: 0x2de1e1, cost: 35, stat: 'brain', desc: 'Filters water. Also scrubs rads.' },
  copium: { id: 'copium', name: 'Copium Den', short: 'COPIUM', color: 0xff5fb0, cost: 40, stat: 'vibes', desc: 'Brews copium. Spend it to calm the vibe swings.' },
  rugdetector: { id: 'rugdetector', name: 'Rug Detector', short: 'RUG DET.', color: 0xff3b3b, cost: 45, stat: 'hands', desc: 'Raid defense. Beeps at Dave.' },
  shill: { id: 'shill', name: 'Shill Tower', short: 'SHILL', color: 0xffe14d, cost: 50, stat: 'vibes', desc: 'Broadcasts to survivors. Recruits new degens.' },
  memelab: { id: 'memelab', name: 'Meme Lab', short: 'MEME LAB', color: 0x9b4dff, cost: 60, stat: 'brain', desc: 'Research. Produces Bags.' },
  storage: { id: 'storage', name: 'Cold Storage', short: 'STORAGE', color: 0x8fa3b8, cost: 30, stat: null, desc: '+ramen and +water capacity. No workers.' },
  grass: { id: 'grass', name: 'Touch Grass Hydroponics', short: 'GRASS', color: 0x2bd96b, cost: 45, stat: 'vibes', desc: 'Dampens the vibe pendulum.' },
};

export const ROOM_ORDER: RoomType[] = ['reactor', 'kitchen', 'pool', 'copium', 'grass', 'rugdetector', 'storage', 'shill', 'memelab'];

// ---------- Archetypes ----------
export interface ArchDef {
  id: ArchId;
  name: string;
  color: number;
  perk: string;
  curse: string;
  stats: Record<StatKey, number>;
}

export const ARCHS: Record<ArchId, ArchDef> = {
  maxi: { id: 'maxi', name: 'Laser-Eyes Maxi', color: 0xff7a1a, perk: 'Never rage-quits.', curse: '-30% output in any room that isn\'t the Reactor.', stats: { grind: 6, brain: 3, vibes: 4, hands: 9 } },
  pete: { id: 'pete', name: 'Paper Hands Pete', color: 0xf2f2f2, perk: '+50% output.', curse: 'Hides during raids. Quits first when it\'s so over.', stats: { grind: 7, brain: 4, vibes: 3, hands: 1 } },
  farmer: { id: 'farmer', name: 'Airdrop Farmer', color: 0x6b8e23, perk: 'Double expedition loot.', curse: '15% of loot is a trap.', stats: { grind: 4, brain: 4, vibes: 5, hands: 5 } },
  midcurve: { id: 'midcurve', name: 'Mid-Curve Max', color: 0xc8b89a, perk: 'Can\'t die before day 4.', curse: 'Exactly average at everything.', stats: { grind: 5, brain: 5, vibes: 5, hands: 5 } },
  gigabrain: { id: 'gigabrain', name: 'Gigabrain Quant', color: 0xffa3b5, perk: 'Triple Meme Lab output.', curse: 'Eats copium.', stats: { grind: 2, brain: 10, vibes: 3, hands: 4 } },
  rugpuller: { id: 'rugpuller', name: 'Reformed Rug Puller', color: 0x222222, perk: '+50% expedition loot.', curse: 'Sometimes "migrates liquidity".', stats: { grind: 4, brain: 6, vibes: 6, hands: 3 } },
  replyguy: { id: 'replyguy', name: 'Reply Guy', color: 0xd83a3a, perk: '+15% output for roommates.', curse: 'Unbearable. Raises everyone\'s blood pressure.', stats: { grind: 5, brain: 2, vibes: 8, hands: 5 } },
  intern: { id: 'intern', name: 'DAO Intern', color: 0x333344, perk: 'Eats half rations. Works for free.', curse: 'Nobody knows who hired her.', stats: { grind: 8, brain: 4, vibes: 2, hands: 4 } },
  larry: { id: 'larry', name: 'Exit Liquidity Larry', color: 0x7a7a7a, perk: 'Arrives with a Bag.', curse: 'Shows up when you\'re winning.', stats: { grind: 3, brain: 3, vibes: 7, hands: 6 } },
};

export const STARTER_ARCHS: ArchId[] = ['maxi', 'pete', 'farmer', 'midcurve', 'gigabrain', 'rugpuller', 'replyguy', 'intern'];

export const NAMES = [
  'Kevin', 'Dave', 'Chad', 'Brenda', 'Tyler', 'Jenna', 'Big Mike', 'Doug', 'Trish', 'Nate', 'Priya', 'Marcus',
  'Steph', 'Lenny', 'Bo', 'Rhonda', 'Kyle', 'Moe', 'Tess', 'Wren', 'Hank', 'Dina', 'Zed', 'kevin.eth',
  'Sir Pumpsalot', 'Deb', 'Ozzie', 'Juno', 'Gus', 'Fern', 'Rico', 'Mags',
];

// ---------- Bags (relics) ----------
export interface BagDef {
  id: BagId;
  name: string;
  desc: string;
}

export const BAGS: Record<BagId, BagDef> = {
  hwnecklace: { id: 'hwnecklace', name: 'Hardware Wallet Necklace', desc: 'Saves one degen from liquidation. Then it\'s gone.' },
  whitepaper: { id: 'whitepaper', name: 'Signed Whitepaper (Blank)', desc: 'Meme Lab research x2.' },
  lambokeys: { id: 'lambokeys', name: 'Lambo Keys (No Lambo)', desc: 'Expeditions 30% faster. 0% safer.' },
  ledger: { id: 'ledger', name: 'Ledger of a Dead Man', desc: '+200 ramen when found. Haunted.' },
  laserpointer: { id: 'laserpointer', name: 'Laser Pointer', desc: 'Everyone +1 Hands. Laser eyes for all.' },
  safu: { id: 'safu', name: 'Funds Are SAFU Lockbox', desc: 'Raiders can\'t steal ramen.' },
  fewunderstand: { id: 'fewunderstand', name: '"Few Understand" Scroll', desc: 'Degens with Brain under 4 get +2 Brain.' },
  mrenft: { id: 'mrenft', name: 'Expired MRE NFT', desc: 'The first time ramen hits 0, eat it: +60 ramen.' },
};

// ---------- Expeditions ----------
export interface LocDef {
  id: string;
  name: string;
  dur: number;
  risk: number;
  loot: Partial<Record<ResKey, [number, number]>>;
  bagChance: number;
  rads: [number, number];
}

export const LOCATIONS: LocDef[] = [
  { id: 'exchange', name: 'Ruins of a Delisted Exchange', dur: 30, risk: 0.07, loot: { ramen: [30, 70], water: [0, 25] }, bagChance: 0.1, rads: [5, 15] },
  { id: 'mine', name: 'Abandoned Mining Farm (still warm)', dur: 45, risk: 0.17, loot: { power: [25, 60], copium: [5, 20] }, bagChance: 0.25, rads: [10, 25] },
  { id: 'gz', name: 'Ground Zero', dur: 60, risk: 0.33, loot: { ramen: [70, 160], copium: [10, 25] }, bagChance: 0.6, rads: [25, 50] },
];

// ---------- HATCH ----------
export type HatchTrigger =
  | 'start' | 'drop' | 'nopower' | 'starving' | 'thirsty' | 'over' | 'back' | 'balanced'
  | 'death' | 'raid' | 'raidwon' | 'raidlost' | 'bag' | 'recruit' | 'cope' | 'idle' | 'quit' | 'yolo' | 'dayStart';

export const HATCH_LINES: Record<HatchTrigger, [HatchMood, string][]> = {
  start: [
    ['smug', 'Hello. I am HATCH, your bunker OS. The bombs drop in 75 seconds. Spend wisely. Or don\'t. I\'m a monitor.'],
  ],
  drop: [
    ['laugh', 'gm.'],
    ['smug', 'Well. That happened. Welcome underground.'],
  ],
  nopower: [
    ['panic', 'Reactor at 0%. Have you tried believing harder?'],
    ['angry', 'No power. I am running on spite and a 9-volt battery.'],
  ],
  starving: [
    ['cry', 'We are out of ramen. Ramen is food. Ramen is also money. We are poor AND hungry.'],
    ['panic', 'Dwellers report the ramen tastes like nothing, because there is none.'],
  ],
  thirsty: [
    ['panic', 'Water reserves: zero. Please do not drink from the reactor.'],
  ],
  over: [
    ['cry', 'It is so over. Three dwellers are drafting farewell threads.'],
    ['cry', 'Morale has gone full bear market. Someone is playing sad violin in the vents.'],
  ],
  back: [
    ['laugh', 'WE ARE SO BACK. Someone just opened a leveraged position on canned beans.'],
    ['panic', 'Euphoria detected. Someone is putting on a hazmat suit to "buy the dip" outside.'],
  ],
  balanced: [
    ['neutral', 'Vibes stable. Suspiciously stable.'],
  ],
  death: [
    ['cry', 'A degen got liquidated. Press F.'],
    ['dead', 'Another one gone. Their portfolio outlived them.'],
  ],
  raid: [
    ['angry', 'RAID. The Liquidators are at the porta-potty. Everyone to your stations.'],
  ],
  raidwon: [
    ['laugh', 'Raiders liquidated. Their loot is our loot now. Number go up.'],
  ],
  raidlost: [
    ['angry', 'They left with our ramen. Rebuild. Cope. Repeat.'],
  ],
  bag: [
    ['smug', 'New Bag acquired. You are now holding bags. Congratulations.'],
  ],
  recruit: [
    ['neutral', 'A new survivor crawled out of the porta-potty. Do not ask how they found us.'],
  ],
  cope: [
    ['sleep', 'Copium deployed. Everyone is breathing slowly into paper bags.'],
  ],
  idle: [
    ['smug', 'Unemployed degens detected. They are watching charts that no longer exist.'],
  ],
  quit: [
    ['cry', 'A degen rage-quit the bunker. Last words: "this is financial advice."'],
  ],
  yolo: [
    ['panic', 'A euphoric degen went outside without a suit. They said "zoom out." They are now zoomed out.'],
  ],
  dayStart: [
    ['neutral', 'New day. Same apocalypse.'],
    ['smug', 'Good morning. The sky is still green. That is not a bullish signal.'],
    ['neutral', 'Day report: we are alive. Barely. Like most portfolios.'],
  ],
};

export const PREP_NEWS = [
  'BREAKING: Leaders of Ostravia and the Republic of Vlerk exchange strongly worded posts.',
  'Markets react to nuclear tensions: up 4%. Analysts "not sure why."',
  'Ostravia moves warheads to border. Vlerk responds with a meme.',
  'Grocery stores report run on instant ramen. Ramen futures limit up.',
  'Influencer posts "bunker tour" sponsored by a VPN.',
  'Doomsday Clock set to 11:59:59. Clockmakers ask to be left alone.',
  'Your group chat: "is this the bottom?"',
  'Emergency Broadcast System test. This is not a test. Also, do not sell.',
];
