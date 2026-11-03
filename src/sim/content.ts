import type { ArchId, BagId, HatchMood, ResKey, RoomType, StatKey } from './types';

// ---------- Tuning ----------
/** A day in sim-seconds. All economy rates are tuned against this. */
export const DAY_SECONDS = 24;
/** Real seconds a day takes at 1x speed. Slower than sim time so runs leave room
 *  for reading and room pop-outs. Wallet transactions happen before and after a run, never mid-run. */
export const REAL_SECONDS_PER_DAY = 36;
/** Sim-seconds per real second while underground (outside boss fights). */
export const UNDERGROUND_PACE = DAY_SECONDS / REAL_SECONDS_PER_DAY;
export const RUN_DAYS = 30;
export const PREP_SECONDS = 75;
// The drop waits for the cinematic to call skipDrop(); this is only a fallback.
export const DROP_SECONDS = 20;
export const COLS = 6;
export const MAX_FLOORS = 6;
export const POP_CAP = 14;
export const BAG_SOFT_CAP = 5;
/** Underground days a Tent Mode (no Deed) run gets before the tent gives out. */
export const TENT_DAYS = 3;

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
  rocket: { id: 'rocket', name: 'Rocket Room', short: 'ROCKET', color: 0xffffff, cost: 150, stat: 'grind', desc: 'Build a rocket out of a water heater and a porta-potty. Leave Earth.' },
};

export const ROOM_ORDER: RoomType[] = ['reactor', 'kitchen', 'pool', 'copium', 'grass', 'rugdetector', 'storage', 'shill', 'memelab', 'rocket'];

// ---------- Archetypes ----------
export interface ArchDef {
  id: ArchId;
  name: string;
  color: number;
  rarity: Rarity;
  perk: string;
  curse: string;
  stats: Record<StatKey, number>;
  /** Number of art variants (sprites `<id>.webp`, `<id>-b.webp`, ...). */
  looks: number;
}

export const ARCHS: Record<ArchId, ArchDef> = {
  maxi: { id: 'maxi', name: 'Laser-Eyes Maxi', color: 0xff7a1a, rarity: 'rare', looks: 2, perk: 'Never rage-quits.', curse: '-30% output in any room that isn\'t the Reactor.', stats: { grind: 6, brain: 3, vibes: 4, hands: 9 } },
  pete: { id: 'pete', name: 'Paper Hands Pete', color: 0xf2f2f2, rarity: 'common', looks: 2, perk: '+50% output.', curse: 'Hides during raids. Quits first when it\'s so over.', stats: { grind: 7, brain: 4, vibes: 3, hands: 1 } },
  farmer: { id: 'farmer', name: 'Airdrop Farmer', color: 0x6b8e23, rarity: 'common', looks: 2, perk: 'Double expedition loot.', curse: '15% of loot is a trap.', stats: { grind: 4, brain: 4, vibes: 5, hands: 5 } },
  midcurve: { id: 'midcurve', name: 'Mid-Curve Max', color: 0xc8b89a, rarity: 'common', looks: 2, perk: 'Can\'t die before day 4.', curse: 'Exactly average at everything.', stats: { grind: 5, brain: 5, vibes: 5, hands: 5 } },
  gigabrain: { id: 'gigabrain', name: 'Gigabrain Quant', color: 0xffa3b5, rarity: 'rare', looks: 2, perk: 'Triple Meme Lab output.', curse: 'Eats copium.', stats: { grind: 2, brain: 10, vibes: 3, hands: 4 } },
  rugpuller: { id: 'rugpuller', name: 'Reformed Rug Puller', color: 0x222222, rarity: 'rare', looks: 2, perk: '+50% expedition loot.', curse: 'Sometimes "migrates liquidity".', stats: { grind: 4, brain: 6, vibes: 6, hands: 3 } },
  replyguy: { id: 'replyguy', name: 'Reply Guy', color: 0xd83a3a, rarity: 'common', looks: 2, perk: '+15% output for roommates.', curse: 'Unbearable. Raises everyone\'s blood pressure.', stats: { grind: 5, brain: 2, vibes: 8, hands: 5 } },
  intern: { id: 'intern', name: 'DAO Intern', color: 0x333344, rarity: 'common', looks: 2, perk: 'Eats half rations. Works for free.', curse: 'Nobody knows who hired them.', stats: { grind: 8, brain: 4, vibes: 2, hands: 4 } },
  larry: { id: 'larry', name: 'Exit Liquidity Larry', color: 0x7a7a7a, rarity: 'rare', looks: 1, perk: 'Arrives with a Bag.', curse: 'Shows up when you\'re winning.', stats: { grind: 3, brain: 3, vibes: 7, hands: 6 } },
  mevbot: { id: 'mevbot', name: 'MEV Bot', color: 0x55ff99, rarity: 'legendary', looks: 2, perk: '+25% output in any room. Never sleeps.', curse: 'Front-runs everyone\'s lunch: eats double.', stats: { grind: 9, brain: 8, vibes: 1, hands: 7 } },
  nftartist: { id: 'nftartist', name: 'NFT Artist', color: 0x9b4dff, rarity: 'common', looks: 2, perk: '+50% in the Meme Lab and Copium Den.', curse: '-20% anywhere else. Huffs extra copium.', stats: { grind: 2, brain: 5, vibes: 8, hands: 3 } },
  influencer: { id: 'influencer', name: 'The Influencer', color: 0xff5fb0, rarity: 'common', looks: 2, perk: 'Shill Tower x2.5.', curse: 'Half output in the Kitchen and Reactor. "Not my brand."', stats: { grind: 2, brain: 3, vibes: 10, hands: 4 } },
  memedev: { id: 'memedev', name: 'Memecoin Dev', color: 0xffe14d, rarity: 'rare', looks: 2, perk: '+40% Meme Lab output.', curse: 'Sometimes launches a coin overnight. It goes to zero. Or it doesn\'t.', stats: { grind: 6, brain: 7, vibes: 4, hands: 2 } },
  yieldfarmer: { id: 'yieldfarmer', name: 'Yield Farmer', color: 0xc89b3c, rarity: 'common', looks: 2, perk: '+30% in the Kitchen, Pool and Grass room.', curse: '-1 Hands. Farms, then dumps.', stats: { grind: 7, brain: 4, vibes: 5, hands: 3 } },
  coldcarl: { id: 'coldcarl', name: 'Cold Storage Carl', color: 0x9fd8ff, rarity: 'rare', looks: 2, perk: '+60 ramen and +40 water storage. Raiders steal half.', curse: 'Refuses to go outside. Ever.', stats: { grind: 5, brain: 5, vibes: 2, hands: 10 } },
  vc: { id: 'vc', name: 'The VC', color: 0x2a3d66, rarity: 'rare', looks: 2, perk: '+40% output for roommates ("advising").', curse: 'Personally produces almost nothing. Takes 20%.', stats: { grind: 1, brain: 7, vibes: 6, hands: 6 } },
  rekt: { id: 'rekt', name: 'Rekt Guy', color: 0x8a8a8a, rarity: 'common', looks: 2, perk: 'Never quits. +60% output when it\'s so over.', curse: 'Permanently crying.', stats: { grind: 6, brain: 3, vibes: 1, hands: 8 } },
  grandpa: { id: 'grandpa', name: 'Genesis Grandpa', color: 0xd9c7a1, rarity: 'legendary', looks: 2, perk: '+40% in the Reactor and Pool. Immune to radiation. Mined in 2009.', curse: 'Tells the same story about pizza every day.', stats: { grind: 6, brain: 9, vibes: 7, hands: 10 } },
};

/** Sprite file stem for an archetype's art variant. */
export const spriteFile = (arch: ArchId, look: number) => (look ? `${arch}-b` : arch);

/** Archetypes that can be recruited at random (Larry only arrives by event). */
export const STARTER_ARCHS: ArchId[] = (Object.keys(ARCHS) as ArchId[]).filter((a) => a !== 'larry');
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 10, rare: 4, legendary: 1 };

/** How each sprite look presents, so names and titles match the art. 'x' = robot. */
export type Presentation = 'm' | 'f' | 'x';
export const LOOK_PRESENTATION: Record<ArchId, Presentation[]> = {
  maxi: ['m', 'f'], pete: ['m', 'f'], farmer: ['f', 'm'], midcurve: ['m', 'f'], gigabrain: ['m', 'f'],
  rugpuller: ['m', 'f'], replyguy: ['m', 'f'], intern: ['f', 'm'], larry: ['m'], mevbot: ['x', 'x'],
  nftartist: ['m', 'f'], influencer: ['f', 'm'], memedev: ['m', 'f'], yieldfarmer: ['m', 'f'],
  coldcarl: ['m', 'f'], vc: ['m', 'f'], rekt: ['m', 'f'], grandpa: ['m', 'f'],
};

/** Archetype titles that change with the look (everything else uses ARCHS[...].name). */
const TITLE_BY_LOOK: Partial<Record<ArchId, Partial<Record<Presentation, string>>>> = {
  replyguy: { f: 'Reply Gal' },
  rekt: { f: 'Rekt Gal' },
  grandpa: { f: 'Genesis Grandma' },
};
export const archTitle = (arch: ArchId, look: number): string =>
  TITLE_BY_LOOK[arch]?.[LOOK_PRESENTATION[arch][look] ?? 'x'] ?? ARCHS[arch].name;

export const NAMES: Record<Presentation | 'any', string[]> = {
  m: ['Kevin', 'Dave', 'Chad', 'Tyler', 'Big Mike', 'Doug', 'Nate', 'Marcus', 'Lenny', 'Kyle', 'Moe', 'Hank', 'Gus', 'Rico', 'Ozzie', 'Brad', 'Todd', 'Vince', 'Dmitri', 'Sir Pumpsalot', 'kevin.eth'],
  f: ['Brenda', 'Jenna', 'Trish', 'Priya', 'Steph', 'Rhonda', 'Tess', 'Dina', 'Deb', 'Fern', 'Mags', 'Maya', 'Carla', 'Lexi', 'Nina', 'Becca', 'Madam Moonshot'],
  any: ['Bo', 'Wren', 'Sam', 'Alex', 'Jordan', 'Riley', 'Quinn', 'Rowan', 'Charlie', 'Sky', 'Zed'],
  x: ['BOT-9000', 'Sandwich.exe', 'Frontrunner3', '0xDEAD', 'Gas Goblin', 'MEVster'],
};

// ---------- Bags (relics) ----------
export type Rarity = 'common' | 'rare' | 'legendary';

export interface BagDef {
  id: BagId;
  name: string;
  desc: string;
  flavor: string;
  rarity: Rarity;
  /** What the inspect view's button does. `consume` removes the Bag. */
  action: { label: string; consume: boolean };
}

export const BAGS: Record<BagId, BagDef> = {
  hwnecklace: { id: 'hwnecklace', name: 'Hardware Wallet Necklace', rarity: 'legendary', desc: 'Saves one degen from liquidation. Then it\'s gone.', flavor: 'Not your keys, not your neck.', action: { label: 'Polish it', consume: false } },
  whitepaper: { id: 'whitepaper', name: 'Signed Whitepaper (Blank)', rarity: 'rare', desc: 'Meme Lab research x2.', flavor: 'It\'s signed. That\'s the whole roadmap.', action: { label: 'Read it', consume: false } },
  lambokeys: { id: 'lambokeys', name: 'Lambo Keys (No Lambo)', rarity: 'common', desc: 'Expeditions 30% faster. 0% safer.', flavor: 'The Lambo is "in escrow."', action: { label: 'Press the unlock button', consume: false } },
  ledger: { id: 'ledger', name: 'Ledger of a Dead Man', rarity: 'rare', desc: 'Plug it in for +200 ramen. It\'s haunted, so morale takes a hit.', flavor: 'The sticky note says "sorry."', action: { label: 'Plug it in', consume: true } },
  laserpointer: { id: 'laserpointer', name: 'Laser Pointer', rarity: 'common', desc: 'Everyone +1 Hands. Laser eyes for all.', flavor: 'Price target: yes.', action: { label: 'Point it at a degen', consume: false } },
  safu: { id: 'safu', name: 'Funds Are SAFU Lockbox', rarity: 'rare', desc: 'Raiders can\'t steal ramen.', flavor: 'Three padlocks. Nobody remembers any of the codes.', action: { label: 'Rattle it', consume: false } },
  fewunderstand: { id: 'fewunderstand', name: '"Few Understand" Scroll', rarity: 'legendary', desc: 'Degens with Brain under 4 get +2 Brain.', flavor: 'If you understand it, it stops working.', action: { label: 'Try to understand it', consume: false } },
  mrenft: { id: 'mrenft', name: 'Expired MRE NFT', rarity: 'common', desc: 'Eat it for +60 ramen. Eats itself if ramen hits 0.', flavor: 'Right-click, save as, eat.', action: { label: 'Eat it', consume: true } },
  pickaxe: { id: 'pickaxe', name: 'Emotional Support Pickaxe', rarity: 'common', desc: 'Digging new floors costs 40% less.', flavor: 'It believes in you. It is a pickaxe.', action: { label: 'Hug it', consume: false } },
  diamondgloves: { id: 'diamondgloves', name: 'Diamond Hands Gloves', rarity: 'rare', desc: 'Every degen +2 Hands.', flavor: 'Can\'t sell if you can\'t open your hands.', action: { label: 'Make a fist', consume: false } },
  inhaler: { id: 'inhaler', name: 'Hopium Inhaler', rarity: 'common', desc: 'COPE costs half as much copium.', flavor: 'Two puffs and everything is bullish.', action: { label: 'Take a puff', consume: false } },
  bearspray: { id: 'bearspray', name: 'Bear Spray', rarity: 'common', desc: 'Raiders and bosses hit 30% softer.', flavor: 'Effective against bears. And bear markets, emotionally.', action: { label: 'Test spray', consume: false } },
  bullhorn: { id: 'bullhorn', name: 'Bull Horn', rarity: 'rare', desc: 'Your degens deal 30% more damage in raids.', flavor: 'Every message is "LFG".', action: { label: 'Yell into it', consume: false } },
  tradewatch: { id: 'tradewatch', name: 'Day-Trader Watch', rarity: 'common', desc: '+12 ramen every morning (dividends).', flavor: 'It only shows green candles. It is broken.', action: { label: 'Check the time', consume: false } },
  ramenprinter: { id: 'ramenprinter', name: 'Ramen Printer (Brrr)', rarity: 'legendary', desc: 'Kitchens produce 50% more.', flavor: 'Money printer, but edible.', action: { label: 'Go brrr', consume: false } },
  seedtattoo: { id: 'seedtattoo', name: 'Seed Phrase Tattoo', rarity: 'rare', desc: 'Expedition death risk halved.', flavor: 'All 24 words, on a forearm. Do not wear short sleeves.', action: { label: 'Admire it', consume: false } },
  hazmat: { id: 'hazmat', name: 'Hazmat Onesie', rarity: 'common', desc: 'Radiation damage halved.', flavor: 'Fleece-lined. Rated for nuclear winter.', action: { label: 'Zip it up', consume: false } },
  moonmap: { id: 'moonmap', name: 'Map to the Moon', rarity: 'legendary', desc: 'Unlocks the Rocket Room this run.', flavor: 'It is mostly arrows pointing up.', action: { label: 'Study it', consume: false } },
  tuningfork: { id: 'tuningfork', name: 'Vibe Tuning Fork', rarity: 'rare', desc: 'The vibe pendulum swings half as hard.', flavor: 'Hums at exactly 432 hopium.', action: { label: 'Strike it', consume: false } },
  airdropcrate: { id: 'airdropcrate', name: 'Unopened Airdrop Crate', rarity: 'common', desc: 'Open it. Could be loot. Could be a landmine.', flavor: 'Eligibility: you, probably.', action: { label: 'Crack it open', consume: true } },
};

/** What happens when you fiddle with a passive Bag (pure flavor, no effect). */
export const BAG_FIDGETS: Partial<Record<BagId, string[]>> = {
  hwnecklace: ['It gleams. Everyone feels 4% safer.', 'You polish it. The screen says "HODL". It always says HODL.'],
  whitepaper: ['Still blank. You nod thoughtfully anyway.', 'You hold it up to the light. Still blank. Bullish.'],
  lambokeys: ['BEEP BEEP. Somewhere far away, nothing happens.', 'You press unlock. A raccoon on the surface flinches.'],
  safu: ['It rattles. Something inside rattles back.', 'Funds: still SAFU. Probably.'],
  fewunderstand: ['You almost understood it. Then it was gone.', 'The eye blinks. You did not see that.'],
  pickaxe: ['It whispers "you can dig it." You can.', 'Hugged. The pickaxe feels seen.'],
  diamondgloves: ['You make a fist. You cannot open it again for an hour.', 'Sparkly. Unsellable. Perfect.'],
  inhaler: ['Two puffs. Suddenly you believe in a 100x.', 'Pfffft. Everything smells like a bull run.'],
  bearspray: ['You test spray. A degen walks into it. Eyes: affected.', 'Psssht. A bear somewhere feels uneasy.'],
  bullhorn: ['"LFG!" echoes through the bunker. Three degens yell it back.', 'You yell "WAGMI" so loud the reactor flickers.'],
  tradewatch: ['It is always 9:30am on this watch. Market open. Forever.', 'Green candle. Green candle. Green candle. Nice.'],
  ramenprinter: ['BRRRRRR. A cup of ramen rolls out. Then another.', 'It goes brrr. The noodles go brrr. Inflation is delicious.'],
  seedtattoo: ['Word 17 is "potato." You are sure of it now.', 'You flex. All 24 words ripple.'],
  hazmat: ['Zipped. You feel 50% less glowy.', 'It has feet. Fleece feet. You are unstoppable.'],
  moonmap: ['Every arrow points up. You are starting to understand.', 'There is a little doodle of a porta-potty with flames under it.'],
  tuningfork: ['Hmmmmmmm. The vibes settle a little.', 'Ting. Somewhere, a degen stops panic-selling.'],
};

// ---------- DEFCON difficulty ladder ----------
export interface DefconDef {
  level: number;
  name: string;
  mods: string[];
  score: number;
}
export const DEFCONS: Record<number, DefconDef> = {
  5: { level: 5, name: 'DEFCON 5 · Fade Out', mods: ['The normal apocalypse.'], score: 1 },
  4: { level: 4, name: 'DEFCON 4 · Double Take', mods: ['Raiders and bosses have +40% HP.'], score: 1.25 },
  3: { level: 3, name: 'DEFCON 3 · Round House', mods: ['Raiders +40% HP.', 'Ramen spoils: −3% every day.'], score: 1.5 },
  2: { level: 2, name: 'DEFCON 2 · Fast Pace', mods: ['Raiders +40% HP.', 'Ramen spoils.', 'Only 55s to prep, and panic hits harder.'], score: 1.8 },
  1: { level: 1, name: 'DEFCON 1 · Cocked Pistol', mods: ['All of the above.', 'Rads start at 40 and climb 50% faster.'], score: 2.2 },
};

// ---------- S.E.C. audit (Surface Enforcement Corps) ----------
export const AUDIT_LEGIT: [string, string][] = [
  ['Ramen Inventory', 'Counted twice. Matches the cups in the kitchen.'],
  ['Reactor Safety Report', 'Glows the correct shade of green. Inspector did not die.'],
  ['Headcount Declaration', 'Every degen accounted for. Even Dave.'],
  ['Water Filtration Log', 'Filters changed daily. Flamingo inspected.'],
  ['Expense Report', 'Item: 1 mop. Reason: the puddle.'],
  ['Proof of Reserves', 'Photo of actual cans on actual shelves.'],
  ['Visitor Log', 'One mutant. Asked about restaking. Escorted out.'],
  ['Power Usage Statement', 'Kilowatts in, kilowatts out. Boring. Correct.'],
];
export const AUDIT_FRAUD: [string, string][] = [
  ['Ramen Inventory', '9,000,000 cups (trust me bro).'],
  ['Reactor Safety Report', '"Vibes: immaculate." Signed: the reactor.'],
  ['Expense Report', '40 Lambos. Business use. The business is Lambos.'],
  ['Proof of Reserves', 'A JPEG of a vault. The JPEG is also a vault.'],
  ['Tax Return', 'Box 1: "gm". Box 2: "gn".'],
  ['Audit Firm', 'Dave\'s Cousin LLC (Dave\'s cousin is Dave).'],
  ['Risk Disclosure', 'Risks: none. Up only. Number go up.'],
  ['Board Approval', 'Approved unanimously by Exit Liquidity Larry.'],
  ['Collateral Statement', 'Collateral: future ramen we will definitely have.'],
];

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
  { id: 'peg', name: 'Collapsed Stablecoin Peg', dur: 35, risk: 0.09, loot: { water: [35, 80] }, bagChance: 0.12, rads: [5, 15] },
  { id: 'mansion', name: 'Influencer\'s Bunker Mansion', dur: 40, risk: 0.12, loot: { copium: [15, 35], ramen: [10, 30] }, bagChance: 0.3, rads: [8, 18] },
  { id: 'gz', name: 'Ground Zero', dur: 60, risk: 0.33, loot: { ramen: [70, 160], copium: [10, 25] }, bagChance: 0.6, rads: [25, 50] },
  { id: 'rival', name: 'A Rival Bunker', dur: 50, risk: 0.2, loot: { ramen: [40, 90] }, bagChance: 0.2, rads: [10, 20] },
];
/** Chance a returning degen brings a decision home. */
export const EXPEDITION_CARD_CHANCE = 0.4;

// ---------- HATCH ----------
export type HatchTrigger =
  | 'start' | 'drop' | 'nopower' | 'starving' | 'thirsty' | 'over' | 'back' | 'balanced'
  | 'death' | 'raid' | 'whale' | 'audit' | 'raidwon' | 'raidlost' | 'bag' | 'recruit' | 'cope' | 'idle' | 'quit' | 'yolo' | 'dayStart'
  | 'tent' | 'tentWarn' | 'silo' | 'forged';

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
  whale: [
    ['panic', 'There is a whale in the bunker. I repeat: a whale. It is eating the furniture.'],
  ],
  audit: [
    ['smug', 'The S.E.C. is here. Act natural. Hide the Lambo receipts.'],
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
  tentWarn: [
    ['panic', 'Tent detected. Structural integrity: vibes. I give it one more day.'],
  ],
  tent: [
    ['dead', 'The tent has collapsed. Real bunkers need a Deed, and a Deed needs $BUNKR. You have a sleeping bag.'],
  ],
  silo: [
    ['laugh', 'Silo-tier Deed detected. Gold nameplate installed. I will now laugh at your jokes.'],
  ],
  forged: [
    ['smug', 'Forged Bags on board. If we get liquidated, they might not make it. No pressure.'],
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
    ['smug', 'Good morning. The sky is still on fire. That is not a bullish signal.'],
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
