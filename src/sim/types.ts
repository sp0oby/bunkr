export type ResKey = 'ramen' | 'water' | 'power' | 'copium';
export type StatKey = 'grind' | 'brain' | 'vibes' | 'hands';

export type RoomType =
  | 'reactor'
  | 'kitchen'
  | 'pool'
  | 'copium'
  | 'rugdetector'
  | 'shill'
  | 'memelab'
  | 'storage'
  | 'grass'
  | 'rocket';

export type ArchId =
  | 'maxi'
  | 'pete'
  | 'farmer'
  | 'midcurve'
  | 'gigabrain'
  | 'rugpuller'
  | 'replyguy'
  | 'intern'
  | 'larry'
  | 'mevbot'
  | 'nftartist'
  | 'influencer'
  | 'memedev'
  | 'yieldfarmer'
  | 'coldcarl'
  | 'vc'
  | 'rekt'
  | 'grandpa';

export type BagId =
  | 'hwnecklace'
  | 'whitepaper'
  | 'lambokeys'
  | 'ledger'
  | 'laserpointer'
  | 'safu'
  | 'fewunderstand'
  | 'mrenft'
  | 'pickaxe'
  | 'diamondgloves'
  | 'inhaler'
  | 'bearspray'
  | 'bullhorn'
  | 'tradewatch'
  | 'ramenprinter'
  | 'seedtattoo'
  | 'hazmat'
  | 'moonmap'
  | 'tuningfork'
  | 'airdropcrate';

// Index into the HATCH expression sprite sheet (4x2 grid, row-major).
export type HatchMood = 'neutral' | 'smug' | 'laugh' | 'panic' | 'angry' | 'cry' | 'dead' | 'sleep';

export type Phase = 'prep' | 'drop' | 'underground' | 'ended';

export interface Room {
  id: number;
  type: RoomType;
  floor: number;
  col: number;
  width: number;
}

export type DwellerStatus = 'active' | 'expedition' | 'dead' | 'gone';

export interface Expedition {
  locId: string;
  returnAt: number;
}

export interface Dweller {
  id: number;
  name: string;
  arch: ArchId;
  /** Which art variant of the archetype this degen uses (0 or 1). */
  look: number;
  grind: number;
  brain: number;
  vibes: number;
  hands: number;
  hp: number;
  roomId: number | null;
  status: DwellerStatus;
  exp: Expedition | null;
  deathDay?: number;
  fPaid?: boolean;
}

export type LogKind = 'info' | 'good' | 'bad' | 'hatch';

export interface LogEntry {
  id: number;
  /** Sim time when posted, for toasts. */
  t: number;
  day: number;
  text: string;
  kind: LogKind;
}

export interface Raid {
  kind: 'liquidators' | 'whale';
  name: string;
  hp: number;
  maxHp: number;
  power: number;
  t: number;
  hitTimer: number;
  stolen: number;
}

export interface Ending {
  title: string;
  blurb: string;
  score: number;
  breakdown: [string, number][];
  survived: boolean;
  defcon: number;
  daily: boolean;
}

export interface Stats {
  raidsWon: number;
  raidsLost: number;
  deaths: number;
  quits: number;
  recruits: number;
  expeditions: number;
  cardsPlayed: number;
  peakRamen: number;
  auditsPassed: number;
  whaleSlain: boolean;
  launched: boolean;
}

/** One document in the S.E.C. audit minigame. */
export interface AuditForm {
  title: string;
  claim: string;
  /** True if the form is legit and should be approved. */
  legit: boolean;
}

export interface Audit {
  forms: AuditForm[];
  idx: number;
  correct: number;
  /** Seconds left on the current form. */
  timer: number;
  log: boolean[];
  done: boolean;
  verdict: string | null;
}

export type Defcon = 1 | 2 | 3 | 4 | 5;

/** Settings for a single run, decided on the title screen. */
export interface RunConfig {
  defcon: Defcon;
  daily: boolean;
  startRamen: number;
  extraDegen: boolean;
  startBag: boolean;
  legendLuck: boolean;
  rocket: boolean;
}
