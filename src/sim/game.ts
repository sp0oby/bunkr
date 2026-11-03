import { Rng } from './rng';
import {
  ARCHS, AUDIT_FRAUD, AUDIT_LEGIT, BAGS, BAG_FIDGETS, DEFCONS, BAG_SOFT_CAP, BASE_CAPS, CURSED_TRAITS, MUTATORS, WEATHER, EXPEDITION_CARD_CHANCE, GOOD_TRAITS, MAX_MISSILES, ROOM_MODS, SILO_DAY, TENT_DAYS, COLS, DAY_SECONDS, DROP_SECONDS, HATCH_LINES, LOCATIONS, MAX_FLOORS,
  LOOK_PRESENTATION, NAMES, POP_CAP, archTitle, PREP_SECONDS, RARITY_WEIGHT, ROOMS, RUN_DAYS, STARTER_ARCHS,
  type HatchTrigger,
} from './content';
import { CARDS as CARDS1, type CardDef } from './events';
import { CARDS2 } from './events2';
import { CARDS3 } from './events3';
import { EXPEDITION_CARDS } from './eventsExp';

const CARDS: CardDef[] = [...CARDS1, ...CARDS2, ...CARDS3];
import { HOTSPOTS } from './hotspots';
import { STATIONS } from './content';
import type {
  Audit, AuditForm, MarketEvent, Revive, RunConfig, Station, TraitId,
  ArchId, BagId, Dweller, Ending, HatchMood, LogEntry, LogKind, Phase, Raid, ResKey, Room, RoomType, StatKey, Stats,
} from './types';

export const STEP = 0.1;
/** Minimum sim-seconds between any two HATCH lines (urgent ones skip this). */
const HATCH_GAP = 14;
/** Per-topic cooldowns in sim-seconds (a day is 24s). */
const HATCH_COOLDOWN: Partial<Record<HatchTrigger, number>> = {
  start: 0, drop: 0, raid: 0, raidwon: 30, raidlost: 30,
  death: 40, quit: 60, yolo: 60, bag: 90, recruit: 120, cope: 120,
  dayStart: 72, nopower: 60, starving: 60, thirsty: 60, over: 90, back: 90, balanced: 120, idle: 150,
};
const HATCH_URGENT = new Set<HatchTrigger>(['start', 'drop', 'raid', 'whale', 'audit', 'death']);
export const COPE_COST = 6;

/**
 * Every player action. The game records each call with the sim tick it happened on, so
 * the results server can replay the run from its seed and get the real result instead
 * of trusting the browser's score.
 */
export const ACTIONS = [
  'build', 'digFloor', 'recruit', 'assign', 'cope', 'sendExpedition', 'payRespects', 'skipPrep', 'launch',
  'answerAudit', 'dismissAudit', 'skipDrop', 'chooseCard', 'dismissCard', 'pokeHotspot', 'useBag',
  'pressF', 'dismissRevive', 'smash', 'installMod', 'setStation', 'fireSilo', 'sellBunker', 'rugPull',
] as const;
export type ActionName = (typeof ACTIONS)[number];
/** [tick, action, args]: the action ran after `tick` calls to step(). */
export type Input = [number, ActionName, unknown[]];
/** Seconds to stamp each S.E.C. audit form. */
export const AUDIT_FORM_SECONDS = 4.5;
/** F-to-revive: this many presses before the timer runs out brings a degen back. */
export const REVIVE_PRESSES = 50;
/** Rugging your own bunker is possible from this day (needs Cold Storage). */
export const RUG_DAY = 8;
export const REVIVE_SECONDS = 15;
/** Fastest you can smash raiders by hand (sim seconds between hits). */
const SMASH_COOLDOWN = 0.12;

export interface PendingCard {
  def: CardDef;
  dwellerId: number | null;
  result: string | null;
}

export class Game {
  readonly seed: number;
  rng: Rng;

  phase: Phase = 'prep';
  time = 0; // total sim seconds
  phaseTime = 0; // seconds into the current phase
  day = 0;

  res: Record<ResKey, number> = { ramen: 230, water: 60, power: 60, copium: 20 };
  rates: Record<ResKey, number> = { ramen: 0, water: 0, power: 0, copium: 0 };
  vibe = 0;
  vibeVel = 0;
  rads = 5;

  rooms: Room[] = [];
  dwellers: Dweller[] = [];
  bags: BagId[] = [];
  floorsDug = 1;

  recruitProg = 0;
  researchProg = 0;
  recruitsBought = 0;
  roomsBuilt = 0;

  raid: Raid | null = null;
  raidMod = 1;
  wifiUntil = 0;
  hatchUnpluggedUntil = 0;
  mreUsed = false;
  /** Most recently acquired Bag, for the "NEW BAG" reveal. Cleared by the UI. */
  newBag: BagId | null = null;
  /** Degen id of a legendary who just arrived, for the reveal. Cleared by the UI. */
  newLegend: number | null = null;

  hotspotCd = new Map<string, number>();

  card: PendingCard | null = null;
  /** The S.E.C. audit minigame, while it's running (pauses the sim like a card). */
  audit: Audit | null = null;
  /** How the run ended early, if it did (sold out or rugged). */
  private special: 'exit' | 'rug' | null = null;
  /** Missile Silo: missiles ready to fire, and progress toward the next one. */
  missiles = 0;
  siloProg = 0;
  /** The F-to-revive minigame, while it's running (pauses the sim like the audit). */
  revive: Revive | null = null;
  /** Rocket Room build progress, 0-100. At 100 you can launch. */
  rocketProg = 0;
  readonly config: RunConfig;
  readonly prepSeconds: number;
  nextCardAt = 0;
  seenCards = new Set<string>();

  hatchMood: HatchMood = 'smug';
  hatchLine = '';
  /** Bumps every time HATCH speaks, so a repeated line still pops the bubble. */
  hatchSeq = 0;
  /** Voice clip id for the current line (null for ad-hoc lines with no recording). */
  hatchVoice: string | null = null;
  private hatchQueue: HatchTrigger[] = [];
  private hatchLast = new Map<HatchTrigger, number>();
  private hatchLastAny = -Infinity;
  private hatchSpoken = new Set<string>();
  log: LogEntry[] = [];
  stats: Stats = { raidsWon: 0, raidsLost: 0, deaths: 0, quits: 0, recruits: 0, expeditions: 0, cardsPlayed: 0, peakRamen: 0, auditsPassed: 0, whaleSlain: false, launched: false, revives: 0, bunkersRaided: 0 };
  ending: Ending | null = null;

  /** Bumped whenever something UI-visible changes. */
  version = 0;
  /** One-shot signals for the renderer (flash, shake, etc). */
  fx: string[] = [];
  /** Output produced per room since the renderer last drained it (for popups). */
  roomOut = new Map<number, number>();

  /** Calls to step() so far, paused or not. */
  tick = 0;
  /** Seeds for underground days, filled in by the results server as the run reaches them. */
  readonly daySeeds = new Map<number, number>();
  /** Market events the server dealt with those days (a big $BUNKR pump or dump). */
  readonly dayEvents = new Map<number, MarketEvent>();
  /** Player actions so far, for replay. */
  readonly inputs: Input[] = [];
  /** >0 while the sim (or an action) is running, so nested calls aren't recorded. */
  private depth = 0;

  private nextId = 1;
  private logId = 1;
  private warned = new Set<string>();

  constructor(seed = (Math.random() * 2 ** 31) | 0, config: Partial<RunConfig> = {}) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.config = {
      defcon: 5, daily: false, startRamen: 0, extraDegen: false, startBag: false, legendLuck: false, rocket: false,
      tent: false, deedTier: 0, loadout: [], serverDays: false, mutator: null, weather: null, ...config,
    };
    this.prepSeconds = this.config.defcon <= 2 ? 55 : PREP_SECONDS;
    this.res.ramen += this.config.startRamen;
    // Starting crew: different non-legendary degens.
    const archs = STARTER_ARCHS.filter((a) => ARCHS[a].rarity !== 'legendary');
    for (let i = 0; i < (this.config.extraDegen ? 4 : 3); i++) {
      const a = archs.splice(this.rng.int(0, archs.length - 1), 1)[0];
      this.addDweller(a, undefined, true);
    }
    if (this.config.startBag) this.giveBag();
    for (const b of this.config.loadout) {
      if (this.bags.includes(b)) continue;
      this.bags.push(b);
      this.post(`Forged Bag on board: ${BAGS[b].name}. ${BAGS[b].desc}`, 'good');
    }
    this.recordActions();
    this.say('start');
    this.post('The bombs drop when the T-MINUS clock hits zero. Build your bunker before then. Prices go up as panic sets in.', 'info');
  }

  // ======================================================================
  // Queries
  // ======================================================================

  get alive(): Dweller[] {
    return this.dwellers.filter((d) => d.status === 'active' || d.status === 'expedition');
  }

  get present(): Dweller[] {
    return this.dwellers.filter((d) => d.status === 'active');
  }

  get underground(): boolean {
    return this.phase === 'underground';
  }

  get panicMult(): number {
    if (this.phase !== 'prep') return 1.25;
    // Cheap early, brutal late.
    return 1 + (this.config.defcon <= 2 ? 2 : 1.5) * (this.phaseTime / this.prepSeconds) ** 2;
  }

  get prepLeft(): number {
    return Math.max(0, this.prepSeconds - this.phaseTime);
  }

  get dayProgress(): number {
    return this.underground ? (this.phaseTime % DAY_SECONDS) / DAY_SECONDS : 0;
  }

  caps(): Record<ResKey, number> {
    const c = { ...BASE_CAPS };
    for (const r of this.rooms) {
      if (r.type === 'storage') {
        c.ramen += 150 * r.width;
        c.water += 100 * r.width;
        c.copium += 20 * r.width;
      }
    }
    if (this.present.some((d) => d.arch === 'coldcarl')) {
      c.ramen += 60;
      c.water += 40;
    }
    return c;
  }

  vibeZone(): 'over' | 'balanced' | 'back' | 'cooked' | 'manic' {
    if (this.vibe <= -75) return 'cooked';
    if (this.vibe < -35) return 'over';
    if (this.vibe >= 75) return 'manic';
    if (this.vibe > 35) return 'back';
    return 'balanced';
  }

  vibeMult(): number {
    switch (this.vibeZone()) {
      case 'balanced': return 1.2;
      case 'back': return 1.1;
      case 'manic': return 0.9;
      case 'over': return 0.75;
      case 'cooked': return 0.5;
    }
  }

  roomAt(floor: number, col: number): Room | undefined {
    return this.rooms.find((r) => r.floor === floor && col >= r.col && col < r.col + r.width);
  }

  roomById(id: number | null): Room | undefined {
    return id == null ? undefined : this.rooms.find((r) => r.id === id);
  }

  workersIn(room: Room): Dweller[] {
    return this.dwellers.filter((d) => d.status === 'active' && d.roomId === room.id);
  }

  capacity(room: Room): number {
    return ROOMS[room.type].stat ? 2 * room.width : 0;
  }

  stat(d: Dweller, k: StatKey): number {
    let v = d[k];
    if (k === 'hands' && this.bags.includes('laserpointer')) v += 1;
    if (k === 'hands' && this.bags.includes('diamondgloves')) v += 2;
    if (k === 'brain' && this.bags.includes('fewunderstand') && d.brain < 4) v += 2;
    if (k === 'grind' && this.has(d, 'gymrat')) v += 2;
    if (k === 'brain' && this.has(d, 'bigbrain')) v += 2;
    if (k === 'vibes' && this.has(d, 'maincharacter')) v += 2;
    if (k === 'grind' && this.has(d, 'grasstoucher')) v -= 2;
    return Math.max(1, Math.min(12, v));
  }

  has(d: Dweller, t: TraitId): boolean {
    return d.traits.includes(t);
  }

  /** What the radio is playing (the first Shill Tower decides). */
  station(): Station | null {
    const tower = this.rooms.find((r) => r.type === 'shill');
    return tower ? tower.station ?? 'hopium' : null;
  }

  hasMod(type: RoomType): boolean {
    return this.rooms.some((r) => r.type === type && r.mod);
  }

  /** Bear Market week: everything costs double. */
  get priceMult(): number {
    return this.config.mutator === 'bear' ? 2 : 1;
  }

  buildCost(type: RoomType): number {
    return Math.round(ROOMS[type].cost * (1 + 0.08 * this.roomsBuilt) * this.panicMult * this.priceMult);
  }

  digCost(): number {
    return Math.round(35 * this.floorsDug * this.panicMult * this.priceMult * (this.bags.includes('pickaxe') ? 0.6 : 1));
  }

  recruitCost(): number {
    return Math.round(22 * (1 + 0.35 * this.recruitsBought) * this.panicMult);
  }

  /** Whether a room type can be built at all this run (the Rocket Room is a secret). */
  canBuildType(type: RoomType): boolean {
    if (type === 'silo') return this.underground && this.day >= SILO_DAY && !this.rooms.some((r) => r.type === 'silo');
    if (type !== 'rocket') return true;
    return (this.config.rocket || this.bags.includes('moonmap')) && !this.rooms.some((r) => r.type === 'rocket');
  }

  copeCost(): number {
    return this.bags.includes('inhaler') ? Math.ceil(COPE_COST / 2) : COPE_COST;
  }

  canBuildAt(floor: number, col: number): boolean {
    if (floor >= this.floorsDug || col < 0 || col >= COLS) return false;
    if (this.roomAt(floor, col)) return false;
    return col === 0 || !!this.roomAt(floor, col - 1) || !!this.roomAt(floor, col + 1);
  }

  // ======================================================================
  // Player actions
  // ======================================================================

  build(type: RoomType, floor: number, col: number): boolean {
    if (this.phase === 'ended' || this.phase === 'drop') return false;
    const cost = this.buildCost(type);
    if (!this.canBuildAt(floor, col) || !this.canBuildType(type) || this.res.ramen < cost) return false;
    this.res.ramen -= cost;
    this.roomsBuilt++;
    let room: Room = { id: this.nextId++, type, floor, col, width: 1 };
    this.rooms.push(room);
    // Merge with same-type neighbours up to width 3.
    for (const dir of [-1, 1]) {
      const n = this.roomAt(floor, dir < 0 ? room.col - 1 : room.col + room.width);
      if (n && n.type === type && type !== 'rocket' && type !== 'silo' && n.width + room.width <= 3) {
        const keep = dir < 0 ? n : room;
        const drop = dir < 0 ? room : n;
        keep.col = Math.min(n.col, room.col);
        keep.width = n.width + room.width;
        keep.mod = keep.mod || drop.mod;
        keep.station = keep.station ?? drop.station;
        for (const d of this.dwellers) if (d.roomId === drop.id) d.roomId = keep.id;
        this.rooms = this.rooms.filter((r) => r !== drop);
        room = keep;
        if (keep.width > 1) this.post(`${ROOMS[type].name} merged (x${keep.width}). Bigger room, better output.`, 'good');
      }
    }
    this.post(`ORDER FILLED · BUY 1 ${ROOMS[type].name.toUpperCase()} @ ${cost} 🍜 · slippage: your dignity`, 'info');
    this.fx.push('build');
    this.touch();
    return true;
  }

  digFloor(): boolean {
    const cost = this.digCost();
    if (this.floorsDug >= MAX_FLOORS || this.res.ramen < cost || this.phase === 'ended' || this.phase === 'drop') return false;
    this.res.ramen -= cost;
    this.floorsDug++;
    this.post(`Dug floor ${this.floorsDug}. The shovel was paid in ramen.`, 'info');
    this.fx.push('dig');
    this.touch();
    return true;
  }

  recruit(): boolean {
    const cost = this.recruitCost();
    if (this.phase !== 'prep' || this.res.ramen < cost || this.alive.length >= POP_CAP) return false;
    this.res.ramen -= cost;
    this.recruitsBought++;
    const d = this.addDweller(this.rollArch());
    this.post(`Shilled the group chat. ${d.name} (${archTitle(d.arch, d.look)}) is in.`, 'good');
    this.fx.push('recruit');
    this.touch();
    return true;
  }

  assign(dwellerId: number, roomId: number | null): boolean {
    const d = this.dwellers.find((x) => x.id === dwellerId);
    if (!d || d.status !== 'active') return false;
    if (roomId != null) {
      const room = this.roomById(roomId);
      if (!room || this.workersIn(room).filter((w) => w.id !== d.id).length >= this.capacity(room)) return false;
    }
    d.roomId = roomId;
    if (roomId != null) this.fx.push('assign');
    this.touch();
    return true;
  }

  cope(): boolean {
    const cost = this.copeCost();
    if (this.res.copium < cost || this.phase === 'ended') return false;
    this.res.copium -= cost;
    this.vibeVel *= 0.3;
    this.vibe *= 0.6;
    this.say('cope');
    this.fx.push('cope');
    this.touch();
    return true;
  }

  sendExpedition(dwellerId: number, locId: string): boolean {
    const d = this.dwellers.find((x) => x.id === dwellerId);
    const loc = LOCATIONS.find((l) => l.id === locId);
    if (!d || !loc || d.status !== 'active' || !this.underground) return false;
    if (d.arch === 'coldcarl') {
      this.post(`${d.name} refuses to go outside. "The outside is where the hackers live."`, 'info');
      return false;
    }
    const dur = loc.dur * (this.bags.includes('lambokeys') ? 0.7 : 1);
    d.status = 'expedition';
    d.roomId = null;
    d.exp = { locId, returnAt: this.time + dur, leftAt: this.time };
    this.stats.expeditions++;
    this.post(`${d.name} climbed out the porta-potty toward ${loc.name}.`, 'info');
    this.touch();
    return true;
  }

  payRespects(dwellerId: number): void {
    const d = this.dwellers.find((x) => x.id === dwellerId);
    if (!d || d.status !== 'dead' || d.fPaid) return;
    d.fPaid = true;
    this.vibe += 4;
    this.post(`F. Respects paid to ${d.name}.`, 'info');
    this.touch();
  }

  skipPrep(): void {
    if (this.phase === 'prep') this.phaseTime = this.prepSeconds;
  }

  /** Blast off in the Rocket Room: ends the run with the Moon Mission ending. */
  launch(): boolean {
    if (!this.underground || this.rocketProg < 100 || this.raid || this.audit) return false;
    this.stats.launched = true;
    this.post('3... 2... 1... The porta-potty rocket clears the blast doors. Next stop: the Moon.', 'good');
    this.fx.push('launch');
    this.finish(true);
    return true;
  }

  /** Stamp the current audit form. `null` means the timer ran out. */
  answerAudit(approve: boolean | null): void {
    const a = this.audit;
    if (!a || a.done) return;
    const form = a.forms[a.idx];
    const right = approve !== null && approve === form.legit;
    if (right) a.correct++;
    a.log.push(right);
    this.fx.push(right ? 'stamp' : 'denied');
    a.idx++;
    a.timer = AUDIT_FORM_SECONDS;
    if (a.idx >= a.forms.length) this.resolveAudit();
    this.touch();
  }

  dismissAudit(): void {
    if (this.audit?.done) {
      this.audit = null;
      this.touch();
    }
  }

  /** Called when the drop cinematic finishes (or is skipped). */
  skipDrop(): void {
    if (this.phase === 'drop') this.phaseTime = DROP_SECONDS;
  }

  chooseCard(optionIndex: number): void {
    const c = this.card;
    if (!c || c.result != null) return;
    const opt = c.def.options[optionIndex];
    if (!opt) return;
    const who = this.dwellers.find((d) => d.id === c.dwellerId) ?? null;
    c.result = opt.effect(this, who);
    this.stats.cardsPlayed++;
    this.touch();
  }

  /** Click a gag object in a room. Each object has its own cooldown. */
  pokeHotspot(roomId: number, index: number): string | null {
    const room = this.roomById(roomId);
    const spot = room && HOTSPOTS[room.type][index];
    if (!room || !spot || this.phase === 'ended') return null;
    const key = `${roomId}:${index}`;
    const ready = this.hotspotCd.get(key) ?? 0;
    if (this.time < ready) return `${spot.label}: recharging. Like your portfolio. (${Math.ceil(ready - this.time)}s)`;
    this.hotspotCd.set(key, this.time + 13); // ~20 real seconds at the underground pace
    const text = spot.poke(this, room, this.workersIn(room));
    this.touch();
    return text;
  }

  hotspotReady(roomId: number, index: number): boolean {
    return this.time >= (this.hotspotCd.get(`${roomId}:${index}`) ?? 0);
  }

  dismissCard(): void {
    if (this.card?.result != null) {
      this.card = null;
      this.touch();
    }
  }

  // ======================================================================
  // Helpers used by event cards
  // ======================================================================

  addRes(k: ResKey, n: number): number {
    const before = this.res[k];
    this.res[k] = Math.max(0, Math.min(this.caps()[k], this.res[k] + n));
    return Math.round(this.res[k] - before);
  }

  kick(vibe: number, vel = 0): void {
    this.vibe = Math.max(-100, Math.min(100, this.vibe + vibe));
    this.vibeVel += vel;
  }

  addRads(n: number): void {
    this.rads = Math.max(0, Math.min(100, this.rads + n));
  }

  hurt(d: Dweller, amount: number, cause: string): void {
    if (d.status === 'dead' || d.status === 'gone') return;
    if (this.has(d, 'builtdifferent')) amount *= 0.7;
    if (this.has(d, 'glassjaw')) amount *= 1.4;
    if (d.arch === 'midcurve' && this.day < 4) amount = Math.min(amount, d.hp - 1);
    d.hp -= amount;
    if (d.hp <= 0) this.kill(d, cause);
  }

  kill(d: Dweller, cause: string): void {
    if (this.bags.includes('hwnecklace')) {
      this.bags.splice(this.bags.indexOf('hwnecklace'), 1);
      d.hp = 35;
      this.post(`${d.name} should have died (${cause}) but the Hardware Wallet Necklace took the hit. It's gone now.`, 'good');
      return;
    }
    d.hp = 0;
    d.status = 'dead';
    d.roomId = null;
    d.exp = null;
    d.deathDay = this.day;
    this.stats.deaths++;
    this.kick(-18);
    this.fx.push('death');
    this.post(`${d.name} got liquidated (${cause}). Press F.`, 'bad');
    this.say('death');
    // Everyone gets one shot at a respawn: mash F before the timer runs out.
    if (!d.revived && !this.revive && this.phase === 'underground') {
      d.revived = true;
      this.revive = { dwellerId: d.id, presses: 0, timer: REVIVE_SECONDS, done: false, success: null };
      this.fx.push('revive');
    }
  }

  /** One press of F during the revive minigame. */
  pressF(): void {
    const r = this.revive;
    if (!r || r.done) return;
    r.presses++;
    if (r.presses >= REVIVE_PRESSES) this.resolveRevive(true);
    this.touch();
  }

  private resolveRevive(success: boolean): void {
    const r = this.revive!;
    const d = this.dwellers.find((x) => x.id === r.dwellerId)!;
    r.done = true;
    r.success = success;
    d.fPaid = true;
    if (success) {
      d.status = 'active';
      d.hp = 30;
      d.deathDay = undefined;
      this.stats.deaths--;
      this.stats.revives++;
      this.kick(22);
      this.post(`${d.name} came back from liquidation on pure respect. ${r.presses} Fs. The bunker is a community.`, 'good');
      this.fx.push('raidwon');
    } else {
      this.vibe += 4;
      this.post(`${r.presses}/${REVIVE_PRESSES} Fs. Not enough respect. ${d.name} stays liquidated.`, 'bad');
      this.fx.push('raidlost');
    }
  }

  dismissRevive(): void {
    if (this.revive?.done) {
      this.revive = null;
      this.touch();
    }
  }

  /** During the Liquidators' raid: sell them the bunker. Ends the run (EXIT LIQUIDITY). */
  sellBunker(): void {
    if (this.raid?.kind !== 'liquidators' || this.phase !== 'underground') return;
    const price = Math.round(150 + this.rooms.length * 40);
    this.addRes('ramen', price);
    this.raid = null;
    this.post(`You sold the bunker to the Liquidators for ${price} ramen. They are thrilled. They have no idea.`, 'good');
    this.finishWith('exit');
  }

  /** Cold Storage: take everything and leave. Ends the run (RUGGED YOUR OWN BUNKER). */
  rugPull(): void {
    if (this.phase !== 'underground' || this.day < RUG_DAY || !this.rooms.some((r) => r.type === 'storage') || this.raid || this.audit) return;
    this.post('You emptied Cold Storage into a duffel bag and climbed out the porta-potty alone. The degens are still asleep.', 'bad');
    this.finishWith('rug');
  }

  /** Buy a room's mod (see ROOM_MODS). */
  installMod(roomId: number): boolean {
    const room = this.roomById(roomId);
    const mod = room && ROOM_MODS[room.type];
    if (!room || !mod || room.mod || this.res.ramen < mod.cost || this.phase === 'ended') return false;
    this.res.ramen -= mod.cost;
    room.mod = true;
    this.post(`ORDER FILLED · ${mod.name.toUpperCase()} @ ${mod.cost} 🍜 · ${mod.desc}`, 'good');
    this.fx.push('build');
    this.touch();
    return true;
  }

  /** Change the Shill Tower's radio station. */
  setStation(roomId: number, station: Station): void {
    const room = this.roomById(roomId);
    if (!room || room.type !== 'shill' || !STATIONS[station]) return;
    room.station = station;
    this.post(`The Shill Tower is now playing ${STATIONS[station].name}.`, 'info');
    this.touch();
  }

  /** Fire a missile from the Silo at the boss. */
  fireSilo(): boolean {
    const raid = this.raid;
    if (!raid || this.missiles <= 0 || this.audit || this.revive || this.card) return false;
    this.missiles--;
    const dmg = raid.maxHp * 0.3 * (this.hasMod('silo') ? 1.5 : 1);
    raid.hp -= dmg;
    this.post(`MISSILE AWAY. Direct hit on ${raid.name}. ${this.missiles} left.`, 'good');
    this.fx.push('missile');
    this.touch();
    return true;
  }

  /** Hit the raiders yourself. Every 10th smash is a crit. */
  smash(): void {
    const raid = this.raid;
    if (!raid || this.audit || this.revive || this.card || raid.t - raid.lastSmash < SMASH_COOLDOWN) return;
    raid.lastSmash = raid.t;
    raid.smashes++;
    const crit = raid.smashes % 10 === 0;
    raid.hp -= (raid.kind === 'whale' ? 1.6 : 1.2) * (crit ? 5 : 1);
    this.fx.push(crit ? 'crit' : 'smash');
    this.touch();
  }

  /** Random recruit, weighted by rarity. */
  rollArch(): ArchId {
    const luck = (a: ArchId) => (this.config.legendLuck && ARCHS[a].rarity === 'legendary' ? 3 : 1);
    return this.rng.weighted(STARTER_ARCHS, (a) => RARITY_WEIGHT[ARCHS[a].rarity] * luck(a)) ?? 'midcurve';
  }

  addDweller(arch: ArchId, name?: string, silent = false, forceLook?: number): Dweller {
    const base = ARCHS[arch].stats;
    // Pick the art variant least used by this archetype so lookalikes are rare.
    const looks = ARCHS[arch].looks;
    const lookCount = (l: number) => this.dwellers.filter((x) => x.arch === arch && x.look === l && x.status !== 'gone').length;
    let look = this.rng.int(0, looks - 1);
    for (let l = 0; l < looks; l++) if (lookCount(l) < lookCount(look)) look = l;
    if (forceLook != null) look = forceLook;
    // Names match how the sprite presents; neutral names fit anyone (but not robots).
    const pres = LOOK_PRESENTATION[arch][look] ?? 'x';
    const used = new Set(this.dwellers.map((d) => d.name));
    const pool = pres === 'x' ? NAMES.x : [...NAMES[pres], ...NAMES.any];
    const free = pool.filter((n) => !used.has(n));
    const roll = (v: number) => Math.max(1, Math.min(10, v + this.rng.int(-1, 1)));
    const d: Dweller = {
      id: this.nextId++,
      name: name ?? (free.length ? this.rng.pick(free) : `Anon #${this.nextId}`),
      arch,
      look,
      grind: arch === 'midcurve' ? 5 : roll(base.grind),
      brain: arch === 'midcurve' ? 5 : roll(base.brain),
      vibes: arch === 'midcurve' ? 5 : roll(base.vibes),
      hands: arch === 'midcurve' ? 5 : roll(base.hands),
      hp: 100,
      roomId: null,
      status: 'active',
      exp: null,
      // Mid-Curve Max is exactly average: no traits either way.
      traits: arch === 'midcurve' ? [] : [this.rng.pick(GOOD_TRAITS), this.rng.pick(CURSED_TRAITS)],
    };
    this.dwellers.push(d);
    if (!silent) this.stats.recruits++;
    if (arch === 'larry') this.giveBag();
    if (!silent && ARCHS[arch].rarity === 'legendary') {
      this.newLegend = d.id;
      this.fx.push('legend');
    }
    this.touch();
    return d;
  }

  /** Bags you can carry before Bagholder kicks in. A Basement Deed or better adds a slot. */
  get bagCap(): number {
    return BAG_SOFT_CAP + (this.config.deedTier >= 2 ? 1 : 0);
  }

  giveBag(id?: BagId): BagId | null {
    const pool = (Object.keys(BAGS) as BagId[]).filter((b) => !this.bags.includes(b));
    const bag = id ?? (pool.length ? this.rng.pick(pool) : null);
    if (!bag || this.bags.includes(bag)) return null;
    this.bags.push(bag);
    this.newBag = bag;
    this.post(`New Bag: ${BAGS[bag].name}. ${BAGS[bag].desc}`, 'good');
    if (this.bags.length > this.bagCap) this.post('Bagholder: you are carrying too many bags. Output -10%.', 'bad');
    this.say('bag');
    this.fx.push('bag');
    return bag;
  }

  /** The inspect view's action button for a Bag. */
  useBag(id: BagId): string | null {
    if (!this.bags.includes(id) || this.phase === 'ended') return null;
    const drop = () => this.bags.splice(this.bags.indexOf(id), 1);
    const room = this.caps().ramen - this.res.ramen;
    if ((id === 'ledger' && room < 60) || (id === 'mrenft' && room < 20)) {
      return 'Your ramen storage is too full to take it. Spend some ramen or build Cold Storage first.';
    }
    let text: string;
    switch (id) {
      case 'ledger':
        drop();
        this.kick(-10);
        text = `It boots. It has funds. It also has a ghost. +${this.addRes('ramen', 200)} 🍜. Morale −10.`;
        break;
      case 'mrenft':
        drop();
        this.mreUsed = true;
        text = `You ate the NFT. +${this.addRes('ramen', 60)} 🍜. It tasted like a rug pull.`;
        break;
      case 'airdropcrate': {
        drop();
        const r = this.rng.next();
        if (r < 0.55) {
          const a = this.addRes('ramen', this.rng.int(60, 120));
          const w = this.addRes('water', this.rng.int(20, 50));
          text = `Loot! +${a} 🍜 and +${w} 💧. Eligibility confirmed.`;
        } else if (r < 0.8) {
          const b = this.giveBag();
          text = b ? 'There was a Bag inside the Bag. Bagception.' : 'It was full of packing peanuts. Edible ones? No.';
        } else {
          const d = this.randomPresent();
          if (d) this.hurt(d, 50, 'an airdrop crate that was a landmine');
          text = `It was a landmine. ${d ? `${d.name} −50 HP.` : 'Nobody was hurt. Somehow.'} Classic airdrop.`;
        }
        break;
      }
      case 'laserpointer': {
        const key = 'bag:laserpointer';
        if (this.time < (this.hotspotCd.get(key) ?? 0)) return 'The laser needs to cool down. Like the market.';
        this.hotspotCd.set(key, this.time + 15);
        const d = this.randomPresent();
        if (!d) return 'You point it at the wall. The wall is unimpressed.';
        this.kick(3);
        text = `You point it at ${d.name}. ${d.name} chases the dot for a full minute. Morale +3.`;
        break;
      }
      default:
        text = this.rng.pick(BAG_FIDGETS[id] ?? ['Nothing happens. It\'s a bag.']);
    }
    this.touch();
    return text;
  }

  randomPresent(filter?: (d: Dweller) => boolean): Dweller | null {
    const list = this.present.filter((d) => !filter || filter(d));
    return list.length ? this.rng.pick(list) : null;
  }

  post(text: string, kind: LogKind = 'info'): void {
    this.log.push({ id: this.logId++, t: this.time, day: this.day, text, kind });
    if (this.log.length > 80) this.log.shift();
    this.touch();
  }

  /** HATCH comments on something — but not too often, and never the same thing on repeat. */
  say(trigger: HatchTrigger): void {
    if (this.time < this.hatchUnpluggedUntil) return;
    const urgent = HATCH_URGENT.has(trigger);
    const last = this.hatchLast.get(trigger) ?? -Infinity;
    if (this.time - last < (HATCH_COOLDOWN[trigger] ?? 45)) return;
    if (!urgent && this.time - this.hatchLastAny < HATCH_GAP) return;
    this.hatchLast.set(trigger, this.time);
    this.hatchLastAny = this.time;
    const lines = HATCH_LINES[trigger];
    // Prefer a line HATCH hasn't said yet this run.
    const fresh = lines.map((_, i) => i).filter((i) => !this.hatchSpoken.has(`${trigger}-${i}`));
    const i = fresh.length ? this.rng.pick(fresh) : this.rng.int(0, lines.length - 1);
    const key = `${trigger}-${i}`;
    const [mood, line] = lines[i];
    this.hatchMood = mood;
    this.hatchLine = line;
    this.hatchSeq++;
    // Voice each line only the first time; repeats are text-only.
    this.hatchVoice = this.hatchSpoken.has(key) ? null : key;
    this.hatchSpoken.add(key);
    this.touch();
  }

  touch(): void {
    this.version++;
  }

  // ======================================================================
  // Simulation
  // ======================================================================

  /** Wrap each player action so top-level calls are logged with the current tick. */
  private recordActions(): void {
    const self = this as unknown as Record<ActionName, (...a: unknown[]) => unknown>;
    for (const name of ACTIONS) {
      const fn = self[name].bind(this);
      self[name] = (...args: unknown[]) => {
        if (this.depth === 0 && this.phase !== 'ended') this.inputs.push([this.tick, name, args]);
        this.depth++;
        try {
          return fn(...args);
        } finally {
          this.depth--;
        }
      };
    }
  }

  /**
   * The underground day whose seed the next step needs but doesn't have yet. While this is
   * set, step() does nothing (and doesn't count a tick), so waiting never changes the run.
   */
  awaitingDay(): number | null {
    if (!this.config.serverDays || this.phase === 'ended' || this.card || this.audit || this.revive) return null;
    const next = this.phaseTime + STEP;
    let day: number | null = null;
    if (this.phase === 'drop' && next >= DROP_SECONDS) day = 1;
    else if (this.phase === 'underground') {
      const d = 1 + Math.floor(next / DAY_SECONDS);
      if (d !== this.day && d <= RUN_DAYS) day = d;
    }
    return day != null && !this.daySeeds.has(day) ? day : null;
  }

  private daySeed(day: number): number {
    if (this.config.serverDays) return this.daySeeds.get(day)!;
    return new Rng(this.seed ^ Math.imul(day, 0x9e3779b1)).int(0, 2 ** 31);
  }

  /** Advance by exactly one fixed step. Paused while a card is open. */
  step(): void {
    if (this.awaitingDay() != null) return;
    this.tick++;
    this.depth++;
    try {
      this.stepInner();
    } finally {
      this.depth--;
    }
  }

  private stepInner(): void {
    if (this.phase === 'ended' || this.card) return;
    if (this.revive) {
      // The revive pauses the bunker; only its timer runs.
      if (!this.revive.done) {
        this.revive.timer -= STEP;
        if (this.revive.timer <= 0) this.resolveRevive(false);
      }
      return;
    }
    if (this.audit) {
      // The audit pauses the bunker; only its form timer runs.
      if (!this.audit.done) {
        this.audit.timer -= STEP;
        if (this.audit.timer <= 0) this.answerAudit(null);
      }
      return;
    }
    const dt = STEP;
    this.time += dt;
    this.phaseTime += dt;

    if (this.phase === 'prep') {
      this.produce(dt);
      this.pendulum(dt);
      if (this.phaseTime >= this.prepSeconds) this.startDrop();
    } else if (this.phase === 'drop') {
      if (this.phaseTime >= DROP_SECONDS) this.startUnderground();
    } else {
      const prevDay = this.day;
      this.day = 1 + Math.floor(this.phaseTime / DAY_SECONDS);
      if (this.day !== prevDay) {
        if (this.day <= RUN_DAYS) this.rng.reseed(this.daySeed(this.day));
        this.onNewDay();
        const ev = this.dayEvents.get(this.day);
        if (ev && this.day <= RUN_DAYS) this.marketEvent(ev);
      }
      if (this.day > RUN_DAYS) {
        this.finish(true);
        return;
      }
      if (this.config.tent && this.day > TENT_DAYS) {
        this.finish(false, true);
        return;
      }
      this.produce(dt);
      this.consume(dt);
      this.pendulum(dt);
      this.health(dt);
      this.expeditions();
      this.raidStep(dt);
      this.cardsStep();
      if (this.hatchQueue.length && this.time - this.hatchLastAny >= HATCH_GAP) this.say(this.hatchQueue.shift()!);
    }

    for (const k of ['ramen', 'water', 'power', 'copium'] as ResKey[]) {
      this.res[k] = Math.max(0, Math.min(this.caps()[k], this.res[k]));
    }
    this.stats.peakRamen = Math.max(this.stats.peakRamen, this.res.ramen);
    this.warnings();

    if (this.alive.length === 0 && this.phase === 'underground' && !this.revive) this.finish(false);
  }

  private startDrop(): void {
    this.phase = 'drop';
    this.phaseTime = 0;
    this.fx.push('drop');
    this.post('THE BOMBS HAVE DROPPED. Anyone above ground is now exit liquidity.', 'bad');
    this.touch();
  }

  private startUnderground(): void {
    this.phase = 'underground';
    this.phaseTime = 0;
    this.day = 1;
    this.rng.reseed(this.daySeed(1));
    this.rads = this.config.defcon <= 1 ? 40 : 25;
    this.nextCardAt = 9;
    this.fx.push('landed');
    this.say('drop');
    if (this.config.deedTier >= 4) this.queueSay('silo');
    else if (this.config.loadout.length) this.queueSay('forged');
    if (this.config.tent) this.post(`Tent Mode: no Bunker Deed, so this tent lasts ${TENT_DAYS} days. Hold $BUNKR to get a real bunker.`, 'bad');
    this.post('Day 1 underground. Keep ramen, water and power above zero. Keep the vibes in the middle.', 'info');
    this.touch();
  }

  private onNewDay(): void {
    if (this.day > RUN_DAYS) return;
    if (this.config.tent && this.day === TENT_DAYS) this.queueSay('tentWarn');
    if (this.day > 1) {
      this.say('dayStart');
      this.fx.push('day');
    }
    this.post(`— DAY ${this.day} —`, 'info');
    if (this.day === 10) this.startRaid('liquidators');
    if (this.config.mutator === 'rugseason' && (this.day === 5 || this.day === 16)) {
      this.raidMod *= 0.7;
      this.startRaid('liquidators');
    }
    if (this.day === 20) this.startAudit();
    if (this.day === 28) this.startRaid('whale');
    if (this.day > 1 && this.config.defcon <= 3 && this.res.ramen > 0) {
      const spoiled = Math.round(this.res.ramen * 0.03);
      if (spoiled > 0) {
        this.res.ramen -= spoiled;
        this.post(`${spoiled} ramen spoiled overnight. DEFCON ${this.config.defcon} is not kind to noodles.`, 'bad');
      }
    }
    if (this.day > 1 && this.bags.includes('tradewatch')) this.addRes('ramen', 12);
    if (this.day > 1) this.morningMods();
    if (this.day > 1 && this.config.mutator === 'airdrop' && this.rng.chance(0.6)) this.airdropCrate();
    if (this.day === 24 && !this.dwellers.some((d) => d.arch === 'larry')) {
      this.queueCard('larry');
    }
    // The Reformed Rug Puller occasionally relapses.
    for (const d of this.present) {
      if (d.arch === 'memedev' && this.rng.chance(0.12)) {
        const coin = this.rng.pick(['$BUNKR2', '$RAMEN', '$POTTY', '$GLOW', '$HATCHCOIN', '$FALLOUT']);
        if (this.rng.chance(0.5)) {
          const n = this.addRes('ramen', this.rng.int(30, 70));
          this.post(`${d.name} launched ${coin} overnight. It pumped. +${n} ramen.`, 'good');
        } else {
          const n = Math.min(Math.round(this.res.ramen), this.rng.int(15, 35));
          this.res.ramen -= n;
          this.post(`${d.name} launched ${coin} overnight. It rugged itself. −${n} ramen.`, 'bad');
        }
      }
      if (d.arch === 'rugpuller' && this.rng.chance(0.12)) {
        const n = Math.round(this.res.ramen * 0.12);
        if (n > 0) {
          this.res.ramen -= n;
          this.post(`${d.name} "migrated liquidity" overnight. ${n} ramen is gone. Halo still on.`, 'bad');
        }
      }
    }
    this.touch();
  }

  /** Global output multiplier from vibes, bagholding and wifi distraction. */
  outputMult(): number {
    return this.vibeMult() * (this.bags.length > this.bagCap ? 0.9 : 1) * (this.time < this.wifiUntil ? 0.5 : 1)
      * (this.underground && this.station() === 'blues' ? 1.1 : 1)
      * (this.config.mutator === 'bull' ? 1.25 : this.config.mutator === 'halving' ? 0.75 : 1);
  }

  /** How hard a room is working right now (0 = idle / unpowered). */
  roomEff(room: Room, vm = this.outputMult(), powered = this.res.power > 0): number {
    const def = ROOMS[room.type];
    if (!def.stat || (room.type !== 'reactor' && !powered)) return 0;
    if (room.offlineDay != null && room.offlineDay >= this.day && this.underground) return 0;
    const workers = this.workersIn(room);
    if (!workers.length) return 0;
    const hasReply = workers.some((w) => w.arch === 'replyguy');
    const hasVc = workers.some((w) => w.arch === 'vc');
    const t = room.type;
    const miserable = this.vibe < -35;
    let factor = 0;
    for (const w of workers) {
      let f = 1 + 0.12 * this.stat(w, def.stat);
      switch (w.arch) {
        case 'pete': f *= 1.5; break;
        case 'maxi': if (t !== 'reactor') f *= 0.7; break;
        case 'gigabrain': if (t === 'memelab') f *= 3; break;
        case 'mevbot': f *= 1.25; break;
        case 'nftartist': f *= t === 'memelab' || t === 'copium' ? 1.5 : 0.8; break;
        case 'influencer': if (t === 'shill') f *= 2.5; else if (t === 'kitchen' || t === 'reactor') f *= 0.5; break;
        case 'memedev': if (t === 'memelab') f *= 1.4; break;
        case 'yieldfarmer': if (t === 'kitchen' || t === 'pool' || t === 'grass') f *= 1.3; break;
        case 'vc': f *= 0.3; break;
        case 'rekt': if (miserable) f *= 1.6; break;
        case 'grandpa': if (t === 'reactor' || t === 'pool') f *= 1.4; break;
        default: break;
      }
      if (this.has(w, 'neversleeps')) f *= 1.15;
      if (hasReply && w.arch !== 'replyguy') f *= 1.15;
      if (hasVc && w.arch !== 'vc') f *= 1.4;
      factor += f;
    }
    const modBoost = !room.mod ? 1 : t === 'reactor' ? 3 : t === 'kitchen' ? 1.6 : t === 'pool' ? 1.8 : t === 'copium' ? 2 : t === 'memelab' ? 1.5 : 1;
    return (room.width === 3 ? 1.15 : room.width === 2 ? 1.05 : 1) * factor * vm * modBoost;
  }

  /** Human-readable output line for a room, per in-game day. */
  roomOutput(room: Room): string {
    const e = this.roomEff(room) * DAY_SECONDS;
    if (room.type === 'storage') return `+${150 * room.width} ramen & +${100 * room.width} water storage`;
    if (e <= 0) return this.res.power <= 0 && room.type !== 'reactor' ? 'NO POWER' : 'Nobody working';
    switch (room.type) {
      case 'reactor': return `+${(0.11 * e).toFixed(0)} ⚡ per day`;
      case 'kitchen': return `+${(0.14 * e).toFixed(0)} 🍜 per day`;
      case 'pool': return `+${(0.14 * e).toFixed(0)} 💧 per day, scrubbing rads`;
      case 'copium': return `+${(0.07 * e).toFixed(0)} 💊 per day`;
      case 'shill': return `new degen every ~${Math.ceil(100 / (0.55 * e))} days`;
      case 'memelab': return `new Bag every ~${Math.ceil(100 / (0.45 * e * (this.bags.includes('whitepaper') ? 2 : 1)))} days`;
      case 'grass': return 'calming the vibe swings';
      case 'rocket': return this.rocketProg >= 100 ? 'READY FOR LAUNCH' : `rocket ${Math.floor(this.rocketProg)}% built`;
      case 'rugdetector': return `+${Math.round(30 * this.workersIn(room).reduce((s, w) => s + 1 + 0.12 * this.stat(w, 'hands'), 0))}% raid defense`;
      default: return '';
    }
  }

  private produce(dt: number): void {
    const rates: Record<ResKey, number> = { ramen: 0, water: 0, power: 0, copium: 0 };
    const vm = this.outputMult();
    const powered = this.res.power > 0;
    for (const room of this.rooms) {
      if (room.type !== 'reactor' && room.type !== 'storage') rates.power -= 0.035 * room.width * (room.type === 'copium' && room.mod ? 2.5 : 1);
      const eff = this.roomEff(room, vm, powered);
      if (eff <= 0) continue;
      const out = (n: number) => this.roomOut.set(room.id, (this.roomOut.get(room.id) ?? 0) + n * dt);
      switch (room.type) {
        case 'reactor': rates.power += 0.11 * eff; out(0.11 * eff); break;
        case 'kitchen': {
          const k = 0.14 * eff * (this.bags.includes('ramenprinter') ? 1.5 : 1);
          rates.ramen += k;
          out(k);
          break;
        }
        case 'rocket':
          if (this.underground && this.rocketProg < 100) {
            this.rocketProg = Math.min(100, this.rocketProg + 0.35 * eff * dt);
            if (this.rocketProg >= 100) {
              this.post('THE ROCKET IS READY. Open the Rocket Room to launch. This ends the run.', 'good');
              this.fx.push('bag');
            }
          }
          break;
        case 'pool':
          rates.water += 0.14 * eff;
          out(0.14 * eff);
          if (this.underground) this.addRads(-0.006 * eff * dt);
          break;
        case 'copium': rates.copium += 0.07 * eff; out(0.07 * eff); break;
        case 'shill':
          if (this.underground && this.alive.length < POP_CAP) {
            this.recruitProg += 0.55 * eff * dt * (this.station() === 'hopium' ? 1.2 : 1);
            if (this.recruitProg >= 100) {
              this.recruitProg = 0;
              const d = this.addDweller(this.rollArch());
              this.post(`${d.name} (${archTitle(d.arch, d.look)}) heard the Shill Tower and crawled in.`, 'good');
              this.say('recruit');
              this.fx.push('recruit');
            }
          }
          break;
        case 'memelab':
          this.researchProg += 0.45 * eff * dt * (this.bags.includes('whitepaper') ? 2 : 1);
          if (this.researchProg >= 100) {
            this.researchProg = 0;
            if (!this.giveBag()) this.addRes('copium', 20);
          }
          break;
        case 'grass':
          this.vibeVel *= 1 - Math.min(0.5, 0.025 * eff * (room.mod ? 2 : 1)) * dt;
          break;
        case 'silo':
          if (this.underground && this.missiles < MAX_MISSILES) {
            this.siloProg += 0.3 * eff * dt;
            if (this.siloProg >= 100) {
              this.siloProg = 0;
              this.missiles++;
              this.post(`Missile ${this.missiles}/${MAX_MISSILES} ready in the Silo. Save it for a boss.`, 'good');
            }
          }
          break;
        default:
          break;
      }
    }
    for (const d of this.present) if (d.arch === 'gigabrain' || d.arch === 'nftartist') rates.copium -= d.arch === 'gigabrain' ? 0.02 : 0.015;
    for (const k of Object.keys(rates) as ResKey[]) this.res[k] += rates[k] * dt;
    this.rates = rates;
  }

  private consume(dt: number): void {
    let eat = 0;
    for (const d of this.present) eat += (d.arch === 'intern' ? 0.025 : d.arch === 'mevbot' ? 0.1 : 0.05) * (this.has(d, 'bottomless') ? 2 : 1);
    this.res.ramen -= eat * dt;
    this.res.water -= 0.05 * this.present.length * dt;
    this.rates.ramen -= eat;
    this.rates.water -= 0.05 * this.present.length;
    if (this.res.ramen <= 0 && this.bags.includes('mrenft') && !this.mreUsed) {
      this.mreUsed = true;
      this.bags.splice(this.bags.indexOf('mrenft'), 1);
      this.res.ramen = 60;
      this.post('Starving degens ate the Expired MRE NFT. +60 ramen. Tasted like a rug.', 'good');
    }
    this.addRads(0.012 * dt * (this.config.defcon <= 1 ? 1.5 : 1) * (this.config.mutator === 'bull' ? 1.6 : 1) * (this.config.weather === 'bull' ? 1.3 : 1));
  }

  private pendulum(dt: number): void {
    let pressure = 0;
    if (this.underground) {
      if (this.res.ramen <= 0) pressure -= 1.2;
      if (this.res.water <= 0) pressure -= 1.2;
      if (this.res.power <= 0) pressure -= 0.7;
      if (this.rads > 60) pressure -= 0.5;
      if (this.raid) pressure -= this.raid.kind === 'whale' ? 1.0 : 0.6;
      const st = this.station();
      if (st === 'hopium') pressure += 0.25;
      if (st === 'blues') pressure -= 0.25;
      if (st === 'doomer') this.vibeVel *= 1 - 0.012 * dt;
      if (this.config.mutator === 'bull') pressure += 0.3;
      if (this.config.weather === 'bull') pressure += 0.2;
      if (this.config.weather === 'winter') pressure -= 0.2;
    }
    // Spring pulls toward the middle, but degens amplify momentum (negative damping),
    // so the swing grows unless you dampen it with copium or grass.
    const fork = this.bags.includes('tuningfork') ? 0.5 : 1;
    this.vibeVel += (-0.011 * this.vibe + pressure + this.rng.range(-1.6, 1.6) * fork) * dt;
    this.vibeVel *= 1 + 0.006 * fork * dt;
    this.vibe += this.vibeVel * dt;
    if (this.vibe > 100 || this.vibe < -100) {
      this.vibe = Math.max(-100, Math.min(100, this.vibe));
      this.vibeVel *= -0.3;
    }
    if (!this.underground) return;
    const zone = this.vibeZone();
    // Somebody has to stay behind to post the farewell threads.
    if (zone === 'cooked' && this.present.length > 2 && this.rng.chance(0.008 * dt * 10 * (this.station() === 'doomer' ? 0.5 : 1))) {
      const d = this.randomPresent((x) => x.arch !== 'maxi' && x.arch !== 'rekt' && !this.has(x, 'diamondhands'));
      const quitter = this.present.find((x) => x.arch === 'pete') ?? this.present.find((x) => this.has(x, 'weakhands')) ?? d;
      if (quitter) {
        quitter.status = 'gone';
        quitter.roomId = null;
        this.stats.quits++;
        this.post(`${quitter.name} rage-quit the bunker and posted a farewell thread.`, 'bad');
        this.say('quit');
        this.fx.push('quit');
      }
    }
    if (zone === 'manic' && this.rng.chance(0.007 * dt * 10)) {
      const d = this.present.find((x) => this.has(x, 'fomo')) ?? this.randomPresent();
      if (d) {
        if (this.rng.chance(0.25)) {
          const n = this.addRes('ramen', this.rng.int(40, 90));
          this.post(`${d.name} YOLO'd onto the surface and somehow came back with ${n} ramen.`, 'good');
        } else {
          this.kill(d, 'went outside to buy the dip');
          this.say('yolo');
        }
      }
    }
  }

  private health(dt: number): void {
    const starving = this.res.ramen <= 0;
    const thirsty = this.res.water <= 0;
    for (const d of this.present) {
      let dmg = 0;
      if (starving) dmg += 0.7;
      if (thirsty) dmg += 0.7;
      if (this.rads > 50 && d.arch !== 'grandpa') dmg += (this.rads - 50) * 0.012 * (this.bags.includes('hazmat') ? 0.5 : 1);
      if (dmg > 0) this.hurt(d, dmg * dt, starving ? 'starvation' : thirsty ? 'dehydration' : 'radiation');
      else d.hp = Math.min(100, d.hp + 0.4 * dt);
    }
  }

  private expeditions(): void {
    for (const d of this.dwellers) {
      if (d.status !== 'expedition' || !d.exp || this.time < d.exp.returnAt) continue;
      const loc = LOCATIONS.find((l) => l.id === d.exp!.locId)!;
      d.exp = null;
      d.status = 'active';
      const deathChance = Math.max(0.02, loc.risk * (1 + this.rads / 100) - 0.015 * this.stat(d, 'hands')) * (this.bags.includes('seedtattoo') ? 0.5 : 1);
      if (this.rng.chance(deathChance)) {
        this.kill(d, `lost at ${loc.name}`);
        this.post(`${d.name}'s last message from ${loc.name}: "wagmi".`, 'bad');
        continue;
      }
      d.hp -= this.rng.int(loc.rads[0], loc.rads[1]);
      if (d.hp <= 0) d.hp = 5;
      let mult = 1;
      if (d.arch === 'farmer') mult *= 2;
      if (d.arch === 'rugpuller') mult *= 1.5;
      if (this.has(d, 'dumpsterdiver')) mult *= 1.4;
      if (this.config.weather === 'bull') mult *= 1.25;
      if (this.config.weather === 'winter') mult *= 0.75;
      if (d.arch === 'farmer' && this.rng.chance(0.15)) {
        this.hurt(d, 40, 'an airdrop that was actually a landmine');
        this.post(`${d.name} claimed an airdrop. It was a landmine. -40 HP.`, 'bad');
      }
      const got: string[] = [];
      for (const [k, range] of Object.entries(loc.loot) as [ResKey, [number, number]][]) {
        const n = this.addRes(k, Math.round(this.rng.int(range[0], range[1]) * mult));
        if (n > 0) got.push(`${n} ${k}`);
      }
      this.post(`${d.name} is back from ${loc.name} with ${got.join(', ') || 'nothing but trauma'}.`, 'good');
      if (loc.id === 'rival') this.stats.bunkersRaided++;
      if (this.rng.chance(loc.bagChance)) this.giveBag();
      const card = EXPEDITION_CARDS[loc.id];
      if (card && !this.card && this.rng.chance(EXPEDITION_CARD_CHANCE)) this.openCard(card, d);
    }
  }

  private startRaid(kind: 'liquidators' | 'whale'): void {
    const tough = this.config.defcon <= 4 ? 1.4 : 1;
    const whale = kind === 'whale';
    const hp = (whale ? 380 : 130) * this.raidMod * tough * (this.config.weather === 'winter' ? 0.8 : 1);
    this.raid = { kind, name: whale ? 'THE MUTANT WHALE' : 'The Liquidators', hp, maxHp: hp, power: whale ? 9 : 5, t: 0, hitTimer: 0, stolen: 0, smashes: 0, lastSmash: -1 };
    this.raidMod = 1;
    this.say(whale ? 'whale' : 'raid');
    this.fx.push('raid');
    this.post(whale
      ? 'FINAL BOSS: A MUTANT WHALE is dragging itself down the shaft. It is one giant sell wall. Kill it before it eats everything.'
      : `BOSS: ${this.raid.name} are coming through the porta-potty. Defense = everyone's Grind + Hands. Rug Detectors help.`, 'bad');
  }

  /** Day 20: the Surface Enforcement Corps audits your bunker. */
  private startAudit(): void {
    const legit = [...AUDIT_LEGIT];
    const fraud = [...AUDIT_FRAUD];
    const forms: AuditForm[] = [];
    const nLegit = this.rng.int(2, 4);
    for (let i = 0; i < 6; i++) {
      const isLegit = i < nLegit;
      const pool = isLegit ? legit : fraud;
      const [title, claim] = pool.splice(this.rng.int(0, pool.length - 1), 1)[0];
      forms.push({ title, claim, legit: isLegit });
    }
    for (let i = forms.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i);
      [forms[i], forms[j]] = [forms[j], forms[i]];
    }
    this.audit = { forms, idx: 0, correct: 0, timer: AUDIT_FORM_SECONDS, log: [], done: false, verdict: null };
    this.fx.push('audit');
    this.say('audit');
    this.post('BOSS: The S.E.C. (Surface Enforcement Corps) is auditing the bunker. Approve the real paperwork. Reject the fraud.', 'bad');
  }

  private resolveAudit(): void {
    const a = this.audit!;
    a.done = true;
    if (a.correct >= 5) {
      this.stats.auditsPassed++;
      this.kick(20);
      const n = this.addRes('copium', 20);
      a.verdict = `CLEAN AUDIT (${a.correct}/6). The agent nods, stamps your forehead, and leaves. Morale up. +${n} 💊 confiscated from someone else.`;
      this.fx.push('raidwon');
    } else if (a.correct >= 3) {
      const fine = Math.round(this.res.ramen * 0.25 * (this.hasMod('storage') ? 0.5 : 1));
      this.res.ramen -= fine;
      a.verdict = `PASSED WITH CONCERNS (${a.correct}/6). Fined ${fine} ramen for "vibes-based accounting".`;
      this.fx.push('raidlost');
    } else {
      const fine = Math.round(this.res.ramen * 0.35 * (this.hasMod('storage') ? 0.5 : 1));
      this.res.ramen -= fine;
      this.kick(-25);
      let bag = '';
      if (this.bags.length) {
        const b = this.rng.pick(this.bags);
        this.bags.splice(this.bags.indexOf(b), 1);
        bag = ` and confiscated your ${BAGS[b].name}`;
      }
      a.verdict = `FAILED AUDIT (${a.correct}/6). They took ${fine} ramen${bag}. The agent says "see you next cycle."`;
      this.fx.push('raidlost');
    }
    this.post(a.verdict, a.correct >= 5 ? 'good' : 'bad');
  }

  private raidStep(dt: number): void {
    const raid = this.raid;
    if (!raid) return;
    raid.t += dt;
    const fighters = this.present.filter((d) => d.arch !== 'pete');
    let rug = 0;
    for (const r of this.rooms) {
      if (r.type === 'rugdetector') rug += this.workersIn(r).reduce((s, w) => s + 1 + 0.12 * this.stat(w, 'hands'), 0) * (this.config.mutator === 'rugseason' ? 2 : 1);
    }
    const dmg = fighters.reduce((s, d) => s + 1 + 0.15 * this.stat(d, 'grind') + 0.1 * this.stat(d, 'hands'), 0) * (1 + 0.3 * rug) * (this.bags.includes('bullhorn') ? 1.3 : 1);
    raid.hp -= dmg * 1.1 * dt;
    raid.hitTimer += dt;
    if (raid.hitTimer >= 1.5 && fighters.length) {
      raid.hitTimer = 0;
      const victim = this.rng.pick(fighters);
      const hit = raid.power * this.rng.range(0.6, 1.3) * (this.bags.includes('bearspray') ? 0.7 : 1) * (this.hasMod('rugdetector') ? 0.7 : 1);
      this.hurt(victim, hit, raid.kind === 'whale' ? 'swallowed by the Mutant Whale' : `stabbed by ${raid.name}`);
      this.fx.push('hit');
    }
    if (!this.bags.includes('safu')) {
      const carl = this.present.some((d) => d.arch === 'coldcarl');
      const guard = (this.hasMod('rugdetector') ? 0.4 : 1) * (this.hasMod('storage') ? 0.5 : 1);
      const steal = Math.min(this.res.ramen, (carl ? 0.5 : 1) * (raid.kind === 'whale' ? 2.6 : 1.6) * guard * dt);
      this.res.ramen -= steal;
      raid.stolen += steal;
    }
    if (raid.hp <= 0) {
      const whale = raid.kind === 'whale';
      const n = this.addRes('ramen', (whale ? 220 : 60) + raid.stolen);
      this.kick(30);
      this.stats.raidsWon++;
      if (whale) this.stats.whaleSlain = true;
      this.post(whale
        ? `THE MUTANT WHALE IS DOWN. The bunker eats whale ramen for a week. +${n} ramen.`
        : `${raid.name} got liquidated. Looted ${n} ramen off their bodies.`, 'good');
      this.say('raidwon');
      this.fx.push('raidwon');
      if (this.rng.chance(0.5)) this.giveBag();
      this.raid = null;
    } else if (raid.t >= (raid.kind === 'whale' ? 45 : 30)) {
      this.kick(-25);
      this.stats.raidsLost++;
      this.post(`${raid.name} left with ${Math.round(raid.stolen)} ramen. They were not even mad.`, 'bad');
      this.say('raidlost');
      this.fx.push('raidlost');
      this.raid = null;
    }
    this.touch();
  }

  private cardsStep(): void {
    if (this.raid || this.time < this.nextCardAt) return;
    this.nextCardAt = this.time + this.rng.range(DAY_SECONDS * 0.55, DAY_SECONDS * 1.1);
    const candidates = CARDS.filter((c) => !c.special && (!c.needs || c.needs(this)) && !(c.once && this.seenCards.has(c.id)));
    const def = this.rng.weighted(candidates, (c) => (this.seenCards.has(c.id) ? 0.25 : 1) * (c.weight ?? 1));
    if (def) this.openCard(def);
  }

  queueCard(id: string): void {
    const def = CARDS.find((c) => c.id === id);
    if (def) this.openCard(def);
  }

  private openCard(def: CardDef, forWho?: Dweller): void {
    const who = forWho ?? (def.pickDweller ? def.pickDweller(this) : this.randomPresent());
    this.seenCards.add(def.id);
    this.card = { def, dwellerId: who?.id ?? null, result: null };
    this.fx.push('card');
    this.touch();
  }

  private warnings(): void {
    const check = (key: string, cond: boolean, trigger: HatchTrigger) => {
      if (cond && !this.warned.has(key)) {
        this.warned.add(key);
        this.say(trigger);
      } else if (!cond) this.warned.delete(key);
    };
    if (!this.underground) return;
    check('power', this.res.power <= 0, 'nopower');
    check('ramen', this.res.ramen <= 0, 'starving');
    check('water', this.res.water <= 0, 'thirsty');
    const z = this.vibeZone();
    check('over', z === 'cooked', 'over');
    check('back', z === 'manic', 'back');
  }

  /** The chart moved hard: the whole wasteland feels it. */
  private marketEvent(ev: MarketEvent): void {
    if (ev === 'whale') {
      const n = this.addRes('ramen', 80);
      this.kick(15);
      this.post(`WHALE SIGHTED. Somebody just market-bought a mountain of $BUNKR. The wasteland is euphoric. +${n} ramen fell off the truck.`, 'good');
      this.fx.push('raidwon');
    } else {
      this.kick(-20);
      const weak = this.present.find((d) => this.has(d, 'weakhands') || d.arch === 'pete');
      if (weak && this.rng.chance(0.5)) {
        weak.status = 'gone';
        weak.roomId = null;
        this.stats.quits++;
        this.post(`PAPER HANDS STORM. $BUNKR is dumping and ${weak.name} panic-sold their bunk and left. Morale down.`, 'bad');
      } else {
        this.post('PAPER HANDS STORM. $BUNKR is dumping. The whole bunker is staring at the chart. Morale down.', 'bad');
      }
      this.fx.push('raidlost');
    }
  }

  /** Airdrop Season: a crate lands on the porta-potty. */
  private airdropCrate(): void {
    const r = this.rng.next();
    if (r < 0.4 && this.giveBag()) {
      this.post('AIRDROP: a crate landed on the porta-potty. It had a Bag in it. Eligible after all.', 'good');
    } else if (r < 0.75) {
      const n = this.addRes('ramen', this.rng.int(40, 80));
      this.post(`AIRDROP: a crate of ${n} ramen landed on the porta-potty. Nobody knows who sent it. Nobody asks.`, 'good');
    } else {
      const d = this.randomPresent();
      this.addRads(5);
      if (d) this.hurt(d, 25, 'a live airdrop');
      this.post(`AIRDROP: the crate was live ordnance. ${d ? `${d.name} -25 HP, ` : ''}+5 rads. Should have checked the contract.`, 'bad');
      this.fx.push('hit');
    }
  }

  /** Each morning: mods charge their price, traits do their thing. */
  private morningMods(): void {
    for (const room of this.rooms) {
      if (!room.mod) continue;
      if (room.type === 'reactor' && this.rng.chance(0.05)) {
        room.offlineDay = this.day;
        this.addRads(15);
        for (const w of this.workersIn(room)) this.hurt(w, 25, 'a Leverage Coil meltdown');
        this.post('MELTDOWN. The Leverage Coil liquidated itself. Reactor offline today, +15 rads. Leverage is a hell of a drug.', 'bad');
        this.fx.push('raidlost');
      }
      if (room.type === 'kitchen') {
        this.res.ramen = Math.max(0, this.res.ramen - 10);
        this.post('Instant Noodle Futures: 10 ramen of interest paid.', 'info');
      }
      if (room.type === 'pool' && this.res.water > 0) {
        const lost = Math.round(this.res.water * 0.04);
        this.res.water -= lost;
        if (lost) this.post(`Impermanent loss: ${lost} water just... left.`, 'info');
      }
    }
    const doomers = this.present.filter((d) => this.has(d, 'doomposter')).length;
    if (doomers) this.kick(-2 * doomers);
    for (const d of this.present) {
      if (this.has(d, 'alphaleaker') && this.rng.chance(0.3) && this.res.ramen > 20) {
        const n = Math.round(this.res.ramen * 0.03);
        this.res.ramen -= n;
        this.post(`${d.name} leaked the bunker's alpha to the group chat. ${n} ramen walked out the door.`, 'bad');
      }
    }
  }

  /** HATCH says this as soon as the current line has had its moment. */
  private queueSay(trigger: HatchTrigger): void {
    this.hatchQueue.push(trigger);
  }

  private finishWith(kind: 'exit' | 'rug'): void {
    this.special = kind;
    this.finish(false);
  }

  private finish(survived: boolean, tent = false): void {
    this.phase = 'ended';
    const alive = this.alive.length;
    const rug = this.special === 'rug';
    const breakdown: [string, number][] = [
      rug ? ['Survivors (you left them)', 0] : ['Survivors x 250', alive * 250],
      ...(this.stats.launched ? [['Moon Mission', 2500] as [string, number]] : []),
      ...(this.stats.whaleSlain ? [['Mutant Whale slain', 1000] as [string, number]] : []),
      ...(this.stats.auditsPassed ? [['Clean S.E.C. audit', 400] as [string, number]] : []),
      [rug ? 'Ramen in the duffel bag x 3' : 'Ramen', Math.round(this.res.ramen * (rug ? 3 : 1))],
      ['Water', Math.round(this.res.water)],
      ['Copium x 2', Math.round(this.res.copium * 2)],
      ['Bags x 150', this.bags.length * 150],
      ['Days survived x 40', Math.min(this.day, RUN_DAYS) * 40],
      ['Raids won x 300', this.stats.raidsWon * 300],
    ];
    const base = breakdown.reduce((s, [, n]) => s + n, 0);
    const dmult = DEFCONS[this.config.defcon].score;
    if (dmult !== 1) breakdown.push([`DEFCON ${this.config.defcon} multiplier x${dmult}`, Math.round(base * (dmult - 1))]);
    const mut = this.config.mutator ? MUTATORS[this.config.mutator] : null;
    if (mut && mut.score !== 1) breakdown.push([`${mut.name} x${mut.score}`, Math.round(base * dmult * (mut.score - 1))]);
    const wx = this.config.weather ? WEATHER[this.config.weather] : null;
    if (wx && wx.score !== 1) breakdown.push([`${wx.name} x${wx.score}`, Math.round(base * dmult * (mut?.score ?? 1) * (wx.score - 1))]);
    const score = Math.round(base * dmult * (mut?.score ?? 1) * (wx?.score ?? 1));
    let title = 'LIQUIDATED';
    let blurb = `Everyone died by day ${this.day}. The bunker is now a very sad NFT.`;
    if (tent) {
      title = 'TENT COLLAPSED';
      blurb = 'Three days in a tent during nuclear winter. Respectable. Hold $BUNKR for a Bunker Deed and play the full 30 days.';
      this.hatchQueue = [];
      this.hatchLast.delete('tent');
      this.hatchLastAny = -Infinity;
      this.say('tent');
    }
    if (this.special === 'exit') {
      title = 'EXIT LIQUIDITY';
      blurb = 'You sold the bunker to the raiders, at the top. The degens walked out with you. Somewhere, a Liquidator is reading the reactor manual.';
    } else if (rug) {
      title = 'RUGGED YOUR OWN BUNKER';
      blurb = 'You took the ramen, the Bags and the door. The degens woke up to a farewell thread. Dev is not doing something.';
    }
    if (survived) {
      if (this.stats.launched) { title = 'MOON MISSION'; blurb = 'You strapped a porta-potty to a water heater and left the planet. Literally to the moon. Few understand.'; }
      else if (this.stats.bunkersRaided >= 3) { title = 'BECAME THE RAIDERS'; blurb = `You raided ${this.stats.bunkersRaided} other bunkers and surfaced richer than the Liquidators. Somewhere underground, someone is telling stories about you.`; }
      else if (alive >= 8) { title = 'BUNKER DAO'; blurb = 'You surfaced with a whole community. Governance proposal #1: never go back down there.'; }
      else if (this.stats.whaleSlain) { title = 'WHALE HUNTER'; blurb = 'You took down the Mutant Whale and surfaced. Every degen on Earth wants your signal.'; }
      else if (this.res.ramen >= 400) { title = 'RAMEN BARON'; blurb = 'You surfaced holding the world\'s largest ramen reserve. You are the Fed now.'; }
      else if (alive <= 2) { title = 'LAST DEGENS STANDING'; blurb = 'Two survivors. Zero friends. Infinite trauma. Still bullish.'; }
      else { title = 'TOUCHED GRASS'; blurb = 'You climbed out of the porta-potty and touched grass. It was radioactive grass. Still counts.'; }
    }
    this.ending = { title, blurb, score, breakdown, survived, defcon: this.config.defcon, daily: this.config.daily, tent, mutator: this.config.mutator, weather: this.config.weather };
    this.fx.push('end');
    this.touch();
  }
}

/**
 * Re-run a recorded game from its seed: apply each input at its tick, step in between.
 * Same seed + config + inputs = the same game, so this is the server's source of truth.
 */
export function replay(
  seed: number, config: Partial<RunConfig>, inputs: Input[], ticks: number,
  daySeeds?: Map<number, number>, dayEvents?: Map<number, MarketEvent>,
): Game {
  const g = new Game(seed, config);
  for (const [d, s] of daySeeds ?? []) g.daySeeds.set(d, s);
  for (const [d, e] of dayEvents ?? []) g.dayEvents.set(d, e);
  const run = g as unknown as Record<ActionName, (...a: unknown[]) => unknown>;
  let i = 0;
  for (let t = 0; t <= ticks && !g.ending; t++) {
    while (i < inputs.length && inputs[i][0] === t) {
      const [, name, args] = inputs[i++];
      if (!ACTIONS.includes(name)) throw new Error(`Unknown action ${String(name)}`);
      run[name](...args);
    }
    if (t < ticks) {
      if (g.awaitingDay() != null) throw new Error(`Day ${g.awaitingDay()} seed missing`);
      g.step();
    }
  }
  return g;
}
