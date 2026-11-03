import type { Game } from './game';
import type { Dweller, Room, RoomType } from './types';

/** A clickable gag in a room painting. x/y are fractions of the painting (0,0 = top-left). */
export interface Hotspot {
  x: number;
  y: number;
  label: string;
  poke: (g: Game, room: Room, workers: Dweller[]) => string;
}

const pick = <T,>(g: Game, arr: T[]) => g.rng.pick(arr);
const heal = (ws: Dweller[], n: number) => ws.forEach((w) => (w.hp = Math.min(100, w.hp + n)));
const calm = (g: Game, k: number) => {
  g.vibe *= 1 - k;
  g.vibeVel *= 1 - k;
};

export const HOTSPOTS: Record<RoomType, Hotspot[]> = {
  reactor: [
    { x: 0.5, y: 0.42, label: 'Poke the core', poke: (g) => {
      if (g.rng.chance(0.7)) return `It hums approvingly. +${g.addRes('power', 4)} ⚡`;
      g.addRads(3);
      return 'It poked back. +3 rads. Do not poke it again. (You will poke it again.)';
    } },
    { x: 0.12, y: 0.52, label: 'Spin the hamster wheel', poke: (g) => `There is no hamster. There never was. Someone's been running in it at night. +${g.addRes('power', 3)} ⚡` },
    { x: 0.91, y: 0.6, label: 'Press the big button', poke: (g) => {
      g.hatchMood = 'angry';
      g.kick(3);
      return pick(g, ['HATCH: "Please stop pressing things."', 'The button says nothing. The button judges you.', 'You pressed it. A light somewhere turned off. Probably fine.']);
    } },
  ],
  kitchen: [
    { x: 0.4, y: 0.47, label: 'Taste the broth', poke: (_g, _r, ws) => {
      heal(ws, 6);
      return 'Notes of salt, regret and a hint of AA battery. Cooks +6 HP.';
    } },
    { x: 0.62, y: 0.5, label: 'Microwave a fork', poke: (g) => {
      g.addRes('power', -3);
      g.kick(6);
      return 'SPARKS. Everyone cheers. Nobody learns anything. −3 ⚡';
    } },
    { x: 0.74, y: 0.45, label: 'Open the fridge', poke: (g) => `It's just more ramen. Even the ice is ramen. +${g.addRes('ramen', 3)} 🍜` },
  ],
  pool: [
    { x: 0.78, y: 0.58, label: 'Boop the flamingo', poke: (g) => {
      g.kick(5);
      return pick(g, ['It squeaks. Morale +5.', 'The flamingo is the only one here with a stable portfolio.', 'It squeaks in a minor key. Bearish.']);
    } },
    { x: 0.46, y: 0.45, label: 'Check the filters', poke: (g) => {
      g.addRads(-2);
      return 'Filter 1: charcoal. Filter 2: rice. Filter 3: crushed hopes. −2 rads.';
    } },
    { x: 0.93, y: 0.42, label: 'Chug a jug', poke: (g, _r, ws) => {
      g.addRes('water', -2);
      heal(ws, 4);
      return 'Hydrated. Briefly bullish. −2 💧';
    } },
  ],
  copium: [
    { x: 0.2, y: 0.53, label: 'Huff the vapor', poke: (g) => {
      calm(g, 0.3);
      return `Instantly at peace with every bad trade you've ever made. +${g.addRes('copium', 2)} 💊`;
    } },
    { x: 0.61, y: 0.16, label: 'Spin the disco ball', poke: (g) => {
      g.kick(8, 3);
      return 'The Copium Den is now a rave. It is 11am. Nobody can stop it.';
    } },
    { x: 0.8, y: 0.44, label: 'Flip the record', poke: (g) => `Now playing: "${pick(g, ['Funds Are Safu (Slowed + Reverb)', 'Bear Market Lullaby', 'Exit Liquidity (Club Mix)', 'I Bought The Top (Acoustic)', 'Zoom Out (feat. Nobody)'])}"` },
  ],
  rugdetector: [
    { x: 0.5, y: 0.45, label: 'Walk through the detector', poke: (g) => pick(g, [`BEEP. You are ${g.rng.int(12, 97)}% rug.`, 'No beep. Highly suspicious.', 'BEEP BEEP. It was your belt. Your belt is a rug.']) },
    { x: 0.72, y: 0.5, label: 'Inspect the rugs', poke: (g) => {
      g.kick(-3);
      return 'Each rug is tagged with a project name. You recognize most of them. You were in most of them.';
    } },
    { x: 0.16, y: 0.25, label: 'Check the radar', poke: (g) => pick(g, ['Radar shows 3 raiders, 1 whale and a guy selling a course.', 'Radar shows nothing. Radar has seen too much.', 'Radar detects a rug approaching at 40 mph. It is Dave.']) },
  ],
  shill: [
    { x: 0.4, y: 0.42, label: 'Go live', poke: (g) => {
      g.recruitProg += 6;
      return 'You said "gm" into the void. The void said "gm" back. Recruiting +6.';
    } },
    { x: 0.49, y: 0.22, label: 'Toggle ON AIR', poke: (g) => {
      g.kick(4);
      return 'ON AIR. Everyone immediately sits up straighter and lies about their PnL.';
    } },
    { x: 0.69, y: 0.53, label: 'Grab the megaphone', poke: () => 'You yelled "WAGMI". Three degens yelled it back. One cried.' },
  ],
  memelab: [
    { x: 0.5, y: 0.3, label: 'Read the whiteboard', poke: (g) => {
      g.researchProg += 3;
      return 'It\'s a chart of a chart of a chart. At the bottom it just says "number go up?" Research +3.';
    } },
    { x: 0.78, y: 0.55, label: 'Check the 3D print', poke: () => 'It\'s printing a tiny bunker. Inside it, a tinier bunker. It\'s bunkers all the way down.' },
    { x: 0.15, y: 0.35, label: 'Tap the glass', poke: (g) => {
      g.kick(-4);
      return 'The thing inside taps back. Nobody taps the glass anymore.';
    } },
  ],
  storage: [
    { x: 0.53, y: 0.47, label: 'Spin the vault wheel', poke: () => 'Locked. The combination is your seed phrase. You did not write down your seed phrase.' },
    { x: 0.33, y: 0.7, label: 'Open the freezer', poke: (g) => `One frozen pizza labeled "DO NOT EAT — FOR WHEN WE MAKE IT". +${g.addRes('ramen', 2)} 🍜 (from behind it)` },
    { x: 0.94, y: 0.22, label: 'Count the cans', poke: (g) => `Inventory: ${Math.floor(g.res.ramen)} ramen, ${Math.floor(g.res.water)} water, 1 can labeled "???". Don't open the ??? can.` },
  ],
  rocket: [
    { x: 0.5, y: 0.45, label: 'Kick the rocket', poke: (g) => `It clanks. Something falls off. It was probably important. Rocket ${Math.floor(g.rocketProg)}% built.` },
    { x: 0.82, y: 0.6, label: 'Press LAUNCH early', poke: (g) => (g.rocketProg >= 100 ? 'It\'s ready. Use the big LAUNCH button.' : `HATCH: "Absolutely not. It's ${Math.floor(g.rocketProg)}% rocket and ${100 - Math.floor(g.rocketProg)}% hope."`) },
    { x: 0.2, y: 0.3, label: 'Stare at the moon target', poke: () => 'You stare at the moon. The moon does not stare back. Yet.' },
  ],
  silo: [
    { x: 0.5, y: 0.45, label: 'Knock on the missile', poke: (g) => `It knocks back. That is not normal. ${g.missiles} missile${g.missiles === 1 ? '' : 's'} ready.` },
    { x: 0.84, y: 0.64, label: 'Lift the big red cover', poke: (g) => (g.raid && g.missiles ? 'There is a boss here. Use the FIRE button. That is what it is for.' : 'HATCH: "Put the cover down. There is nothing to shoot. Please do not shoot the Liquidity Pool again."') },
    { x: 0.87, y: 0.38, label: 'Count the spare fins', poke: () => 'Six fins. The rocket uses four. Nobody knows what the other two are for. Nobody asks.' },
    { x: 0.95, y: 0.66, label: 'Stare at the lava lamp', poke: (g) => {
      g.kick(3);
      return 'The lava goes up. The lava goes down. Just like the chart, but calming. Vibes up a little.';
    } },
  ],
  grass: [
    { x: 0.83, y: 0.8, label: 'Ask the gnome', poke: (g) => `The gnome says: "${pick(g, ['Touch grass.', 'Buy high, sell never.', 'I have survived four apocalypses. This one has the worst vibes.', 'The real yield was the friends we made.', 'Have you tried not checking the chart?'])}"` },
    { x: 0.76, y: 0.76, label: 'Sit in the lawn chair', poke: (g) => {
      calm(g, 0.35);
      return 'You touch grass. Hydroponic grass. You feel nothing. Then everything. Vibes calmed.';
    } },
    { x: 0.22, y: 0.32, label: 'Smell the grass', poke: (g) => {
      g.kick(4);
      return 'It smells like outside. You had forgotten outside.';
    } },
  ],
};

/** Things degens say when you click them in a room. */
export const WORKER_QUIPS = [
  'I\'m working. I swear.',
  'gm',
  'is this the bottom?',
  'I\'m not paid enough for the apocalypse.',
  'wen lunch',
  'my bags are heavy, ser.',
  'I used to have a Lambo. Well. A picture of one.',
  'can I get a raise in ramen',
  'few understand this job.',
  'I\'m just here so I don\'t get liquidated.',
];
