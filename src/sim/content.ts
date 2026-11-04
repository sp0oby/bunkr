import type { MutatorId, Station, TraitId, Weather, ArchId, BagId, HatchMood, ResKey, RoomType, StatKey } from './types';

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
  memelab: { id: 'memelab', name: 'Meme Lab', short: 'MEME LAB', color: 0x9b4dff, cost: 140, stat: 'brain', desc: 'Research. Slowly produces Bags. One per bunker.' },
  storage: { id: 'storage', name: 'Cold Storage', short: 'STORAGE', color: 0x8fa3b8, cost: 30, stat: null, desc: '+ramen and +water capacity. No workers.' },
  grass: { id: 'grass', name: 'Touch Grass Hydroponics', short: 'GRASS', color: 0x2bd96b, cost: 45, stat: 'vibes', desc: 'Dampens the vibe pendulum.' },
  rocket: { id: 'rocket', name: 'Rocket Room', short: 'ROCKET', color: 0xffffff, cost: 150, stat: 'grind', desc: 'Build a rocket out of a water heater and a porta-potty. Leave Earth.' },
  silo: { id: 'silo', name: 'Missile Silo', short: 'SILO', color: 0xff7a1a, cost: 120, stat: 'grind', desc: 'Builds missiles. Fire them at bosses. Unlocks on day 12.' },
};

export const ROOM_ORDER: RoomType[] = ['reactor', 'kitchen', 'pool', 'copium', 'grass', 'rugdetector', 'storage', 'shill', 'memelab', 'silo', 'rocket'];

/** The Silo is a late build: available from this underground day. */
export const SILO_DAY = 12;
export const MAX_MISSILES = 3;

// ---------- Chart weather ----------
export const WEATHER: Record<Weather, { name: string; desc: string; score: number }> = {
  bull: { name: 'Bull Run Weather', desc: '$BUNKR is pumping. More loot, hotter vibes, and more radiation.', score: 1 },
  winter: { name: 'Nuclear Winter', desc: '$BUNKR is dumping. Less loot, colder vibes, weaker raiders. Score x1.2: buy-the-dip runs pay.', score: 1.2 },
  calm: { name: 'Crab Market', desc: '$BUNKR is going sideways. The wasteland is quiet.', score: 1 },
};

// ---------- Weekly mutators ----------
export interface MutatorDef {
  name: string;
  desc: string;
  /** Score multiplier for the week's suffering. */
  score: number;
}

export const MUTATORS: Record<MutatorId, MutatorDef> = {
  bear: { name: 'Bear Market', desc: 'Everything costs twice as much. Score x1.3.', score: 1.3 },
  bull: { name: 'Bull Run', desc: 'Rooms make 25% more and the vibes run hot. So do the rads: +60%.', score: 1 },
  airdrop: { name: 'Airdrop Season', desc: 'Crates fall from the sky most mornings. Some of them are Bags. Some of them are live.', score: 1 },
  rugseason: { name: 'Rug Season', desc: 'Extra Liquidator raids on days 5 and 16. Rug Detectors work twice as hard. Win, and the loot is yours.', score: 1 },
  halving: { name: 'The Halving', desc: 'All rooms make 25% less. Score x1.5. Number go up, eventually.', score: 1.5 },
};
const MUTATOR_ORDER: MutatorId[] = ['bear', 'bull', 'airdrop', 'rugseason', 'halving'];

/** Mutators rotate every Monday (UTC). `utcDay` = days since 1970-01-01. */
export function mutatorForDay(utcDay: number): MutatorId {
  const week = Math.floor((utcDay + 3) / 7); // 1970-01-01 was a Thursday
  return MUTATOR_ORDER[((week % MUTATOR_ORDER.length) + MUTATOR_ORDER.length) % MUTATOR_ORDER.length];
}
export const utcDayNow = () => Math.floor(Date.now() / 86400_000);

// ---------- Room mods ----------
export interface ModDef {
  name: string;
  cost: number;
  desc: string;
}

/** One upgrade per room type, bought in the room's pop-out. Most come with a catch. */
export const ROOM_MODS: Partial<Record<RoomType, ModDef>> = {
  reactor: { name: 'Leverage Coil', cost: 120, desc: '3x power. 5% chance each morning it melts down: +15 rads, workers hurt, offline for the day.' },
  kitchen: { name: 'Instant Noodle Futures', cost: 100, desc: '+60% ramen, but pays 10 ramen of interest every morning.' },
  pool: { name: 'Impermanent Loss Filter', cost: 100, desc: '+80% water. Loses 4% of stored water every morning to "impermanent loss".' },
  copium: { name: 'Hopium/Copium Swap', cost: 90, desc: 'Double copium. The swap burns extra power.' },
  rugdetector: { name: 'Honeypot Trap', cost: 110, desc: 'Raiders get stuck: they steal 60% less and hit 30% softer.' },
  storage: { name: 'Seed Phrase Tattoo Parlor', cost: 80, desc: 'Half of all raid theft and audit fines bounce off.' },
  memelab: { name: 'Fork Factory', cost: 130, desc: 'Research 50% faster. Every fork is a feature.' },
  grass: { name: 'Astroturf', cost: 70, desc: 'Calms the vibes twice as hard. It is fake grass. Nobody can tell.' },
  silo: { name: 'MIRV Upgrade', cost: 150, desc: 'Missiles hit 50% harder. One missile, many problems.' },
};

// ---------- Radio (Shill Tower) ----------
export const STATIONS: Record<Station, { name: string; desc: string }> = {
  hopium: { name: 'Hopium FM', desc: 'Doo-wop for degens. Pushes the vibes up. Recruits 20% faster.' },
  blues: { name: 'Bear Market Blues', desc: 'Sad harmonica. Pushes the vibes down, but everyone grinds 10% harder.' },
  doomer: { name: 'Doomer Wave', desc: 'Slow synthwave. Steadies the swings. Half as many rage-quits.' },
};

// ---------- Traits ----------
export interface TraitDef {
  name: string;
  good: boolean;
  desc: string;
}

export const TRAITS: Record<TraitId, TraitDef> = {
  diamondhands: { name: 'Diamond Hands', good: true, desc: 'Never rage-quits.' },
  gymrat: { name: 'Gym Rat', good: true, desc: '+2 Grind.' },
  bigbrain: { name: 'Galaxy Brain', good: true, desc: '+2 Brain.' },
  maincharacter: { name: 'Main Character', good: true, desc: '+2 Vibes.' },
  builtdifferent: { name: 'Built Different', good: true, desc: 'Takes 30% less damage.' },
  dumpsterdiver: { name: 'Dumpster Diver', good: true, desc: '+40% expedition loot.' },
  neversleeps: { name: 'Never Sleeps', good: true, desc: 'Works 15% harder.' },
  weakhands: { name: 'Weak Hands', good: false, desc: 'First to rage-quit when it gets bad.' },
  glassjaw: { name: 'Glass Jaw', good: false, desc: 'Takes 40% more damage.' },
  bottomless: { name: 'Bottomless Pit', good: false, desc: 'Eats twice the ramen.' },
  doomposter: { name: 'Doomposter', good: false, desc: 'Drags morale down a little every morning.' },
  alphaleaker: { name: 'Alpha Leaker', good: false, desc: 'Sometimes leaks ramen to the group chat.' },
  grasstoucher: { name: 'Touches Grass Too Much', good: false, desc: '-2 Grind.' },
  fomo: { name: 'Chronic FOMO', good: false, desc: 'First to YOLO onto the surface when it\'s too back.' },
};
export const GOOD_TRAITS = (Object.keys(TRAITS) as TraitId[]).filter((t) => TRAITS[t].good);
export const CURSED_TRAITS = (Object.keys(TRAITS) as TraitId[]).filter((t) => !TRAITS[t].good);

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
  /** Stock Bags: the Robinhood stock ticker it's bought with. Never dropped in runs, never shatters. */
  stock?: string;
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
  seeingstone: { id: 'seeingstone', name: 'The Seeing Stone', rarity: 'legendary', stock: 'PLTR', desc: 'Surveillance: warns you a day before every raid, raiders arrive 20% weaker, and fraud forms are flagged in the S.E.C. audit.', flavor: 'It sees everything. It has opinions about your spending.', action: { label: 'Gaze into it', consume: false } },
  overclockgpu: { id: 'overclockgpu', name: 'Overclocked GPU', rarity: 'legendary', stock: 'NVDA', desc: 'Every room makes 25% more. Every room also eats 30% more power.', flavor: 'Runs at 98°C. Doubles as the bunker\'s heating.', action: { label: 'Check the temps', consume: false } },
  bunkercinema: { id: 'bunkercinema', name: 'Bunker Cinema', rarity: 'legendary', stock: 'AMC', desc: 'Vibe swings are halved, and Movie Night every evening pulls the mood back toward the middle.', flavor: 'Now showing: the same movie, forever. Nobody minds.', action: { label: 'Start the projector', consume: false } },
  starshippass: { id: 'starshippass', name: 'Starship Boarding Pass', rarity: 'legendary', stock: 'SPCX', desc: 'The Rocket Room is unlocked from day 1 and builds twice as fast. A Moon Mission scores +1,000 more.', flavor: 'Seat 1A. Window. Destination: up.', action: { label: 'Check the gate', consume: false } },
  cybertruckkeys: { id: 'cybertruckkeys', name: 'Cybertruck Keys', rarity: 'legendary', stock: 'TSLA', desc: 'Expeditions are 40% faster and armored: a third less likely to end in a funeral.', flavor: 'The windows are bulletproof. Allegedly.', action: { label: 'Honk', consume: false } },
  execmembership: { id: 'execmembership', name: 'Executive Membership', rarity: 'legendary', stock: 'COST', desc: 'Bulk pricing: every room costs 15% less, and Cold Storage holds twice as much.', flavor: 'The hot dog combo is still $1.50. After the apocalypse.', action: { label: 'Flash the card', consume: false } },
};

/** Stock Bags: bought, never found. */
export const isStockBag = (b: BagId) => !!BAGS[b].stock;

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
  seeingstone: ['It shows you Kevin eating ramen at 3am. You did not need to see that.', 'The stone blinks. Three raiders, somewhere, feel watched.'],
  overclockgpu: ['The fans spin up. The whole bunker gets 2 degrees warmer.', 'It renders one frame of a cat. The reactor dims.'],
  bunkercinema: ['The projector clicks on. Everyone stops arguing for 90 minutes.', 'Now playing: a documentary about grass. Degens weep.'],
  starshippass: ['Boarding group: you. Gate: the porta-potty.', 'It says "now boarding" every time you look at it.'],
  cybertruckkeys: ['HONK. A raccoon on the surface files a complaint.', 'You press unlock. Somewhere, a truck the shape of a doorstop flashes its lights.'],
  execmembership: ['You flash the card. A pallet of ramen appears in your heart.', 'Membership verified. You may now buy 48 rolls of toilet paper.'],
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
  | 'tent' | 'tentWarn' | 'silo' | 'forged' | 'revived' | 'missile' | 'whaleSighted' | 'paperStorm';

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
    ['angry', 'Ramen at zero. I have started rationing the ramen smell.'],
  ],
  thirsty: [
    ['panic', 'Water reserves: zero. Please do not drink from the reactor.'],
    ['cry', 'The Liquidity Pool has no liquidity. Like every pool I have ever loved.'],
    ['panic', 'Water is gone. Someone suggested drinking the copium. Please do not drink the copium.'],
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
    ['smug', 'Vibes balanced. Output up. Do not touch anything.'],
    ['laugh', 'Vibes perfectly balanced. Nobody breathe on the chart.'],
  ],
  death: [
    ['cry', 'A degen got liquidated. Press F.'],
    ['dead', 'Another one gone. Their portfolio outlived them.'],
    ['cry', 'Liquidated. They were early. Too early.'],
    ['dead', 'We lost one. HATCH is updating the group chat. HATCH is not crying. HATCH is a monitor.'],
  ],
  raid: [
    ['angry', 'RAID. The Liquidators are at the porta-potty. Everyone to your stations.'],
    ['angry', 'Raiders at the porta-potty. They have leverage. We have ramen. Defend the ramen.'],
  ],
  whale: [
    ['panic', 'There is a whale in the bunker. I repeat: a whale. It is eating the furniture.'],
    ['panic', 'Mutant whale incoming. It is one giant sell wall with teeth.'],
  ],
  audit: [
    ['smug', 'The S.E.C. is here. Act natural. Hide the Lambo receipts.'],
    ['panic', 'Agents from the S.E.C. Say nothing. Say "it is a utility token."'],
  ],
  raidwon: [
    ['laugh', 'Raiders liquidated. Their loot is our loot now. Number go up.'],
    ['laugh', 'They came for our ramen. They left as exit liquidity.'],
    ['smug', 'Raid repelled. Write that down. Actually, I will write that down. I am a monitor.'],
  ],
  raidlost: [
    ['angry', 'They left with our ramen. Rebuild. Cope. Repeat.'],
    ['cry', 'They took the ramen. They took the vibes. They left the porta-potty. Small mercies.'],
  ],
  bag: [
    ['smug', 'New Bag acquired. You are now holding bags. Congratulations.'],
    ['laugh', 'Another Bag. You now hold more bags than a grocery store.'],
    ['smug', 'Bag secured. Diamond hands it. Or do not. I am not your advisor.'],
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
  revived: [
    ['laugh', 'Revived. Fifty Fs. The blockchain of respect has spoken.'],
    ['smug', 'They are back. Respect is the only asset that never got rugged.'],
  ],
  missile: [
    ['laugh', 'Launch away. That is what we call a hard fork.'],
  ],
  whaleSighted: [
    ['laugh', 'Whale sighted. Somebody just bought a mountain of BUNKR. Everyone act rich.'],
  ],
  paperStorm: [
    ['panic', 'Paper hands storm. The chart is bleeding. Do not look at the chart. I said do not look.'],
  ],
  recruit: [
    ['neutral', 'A new survivor crawled out of the porta-potty. Do not ask how they found us.'],
    ['laugh', 'New degen in the bunker. They say they were early. Everyone says that.'],
    ['neutral', 'Population up one. Ramen consumption up one. The math is undefeated.'],
  ],
  cope: [
    ['sleep', 'Copium deployed. Everyone is breathing slowly into paper bags.'],
    ['sleep', 'Copium administered. Vibes descending gently. Like a memecoin.'],
    ['smug', 'One hit of copium. Everyone agrees: we are still early.'],
  ],
  idle: [
    ['smug', 'Unemployed degens detected. They are watching charts that no longer exist.'],
    ['angry', 'Idle degens detected. They are refreshing a dead block explorer.'],
    ['smug', 'Some of you are not working. I can see you. I can see everything.'],
  ],
  quit: [
    ['cry', 'A degen rage-quit the bunker. Last words: "this is financial advice."'],
    ['cry', 'A degen left. They took their bunk and their bags. Mostly the bags.'],
  ],
  yolo: [
    ['panic', 'A euphoric degen went outside without a suit. They said "zoom out." They are now zoomed out.'],
    ['panic', 'Someone went outside to buy the dip. The dip bought them.'],
  ],
  dayStart: [
    ['neutral', 'New day. Same apocalypse.'],
    ['smug', 'Good morning. The sky is still on fire. That is not a bullish signal.'],
    ['neutral', 'Day report: we are alive. Barely. Like most portfolios.'],
    ['laugh', 'gm. Still alive. Bullish.'],
    ['neutral', 'Another sunrise. Probably. I cannot see the sun. I am underground.'],
    ['smug', 'Morning briefing: everything is fine. That was a joke. Nothing is fine.'],
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
