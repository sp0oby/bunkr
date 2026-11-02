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
  | 'grass';

export type ArchId =
  | 'maxi'
  | 'pete'
  | 'farmer'
  | 'midcurve'
  | 'gigabrain'
  | 'rugpuller'
  | 'replyguy'
  | 'intern'
  | 'larry';

export type BagId =
  | 'hwnecklace'
  | 'whitepaper'
  | 'lambokeys'
  | 'ledger'
  | 'laserpointer'
  | 'safu'
  | 'fewunderstand'
  | 'mrenft';

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
}
