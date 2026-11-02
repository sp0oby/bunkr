import type { Game } from './game';
import { ARCHS } from './content';
import type { Dweller } from './types';

export interface CardOption {
  label: string;
  hint?: string;
  effect: (g: Game, who: Dweller | null) => string;
}

export interface CardDef {
  id: string;
  title: string;
  body: (g: Game, who: Dweller | null) => string;
  options: CardOption[];
  needs?: (g: Game) => boolean;
  pickDweller?: (g: Game) => Dweller | null;
  weight?: number;
  once?: boolean;
  /** Only opened by scripted triggers, never drawn randomly. */
  special?: boolean;
}

const nm = (who: Dweller | null) => who?.name ?? 'Someone';
const hasArch = (g: Game, arch: Dweller['arch']) => g.present.some((d) => d.arch === arch);
const archOf = (arch: Dweller['arch']) => (g: Game) => g.present.find((d) => d.arch === arch) ?? null;

export const CARDS: CardDef[] = [
  {
    id: 'timetraveler',
    title: 'KNOCK KNOCK',
    body: () => 'A man at the hatch says he\'s from the future and Bitcoin is $4.',
    once: true,
    options: [
      {
        label: 'Let him in',
        hint: '+1 degen, ??? ',
        effect: (g) => {
          const d = g.addDweller('midcurve', 'Future Steve');
          if (g.rng.chance(0.4)) {
            g.addRads(12);
            return `${d.name} is in. He also brought future radiation. +12 rads.`;
          }
          g.kick(12);
          return `${d.name} is in. He keeps saying "you'll see."`;
        },
      },
      { label: 'Ask what else is $4', hint: 'pure hopium', effect: (g) => { g.kick(28, 6); return '"Everything," he says. The bunker erupts. WE\'RE SO BACK.'; } },
      { label: 'Keep the hatch shut', effect: (g) => { g.kick(-6); return 'He slides a note under the hatch: "ngmi."'; } },
    ],
  },
  {
    id: 'rugbeep',
    title: 'THE RUG DETECTOR IS BEEPING',
    body: (_g, who) => `It's pointing at ${nm(who)}.`,
    needs: (g) => g.rooms.some((r) => r.type === 'rugdetector'),
    options: [
      { label: `Search them`, effect: (g, who) => { const n = g.addRes('ramen', 35); g.kick(-8); return `Found ${n} ramen sewn into ${nm(who)}'s hoodie. Nobody makes eye contact at dinner.`; } },
      { label: 'Trust them', effect: (g, who) => { if (g.rng.chance(0.45)) { const n = Math.round(g.res.ramen * 0.2); g.res.ramen -= n; return `${nm(who)} was, in fact, a rug. -${n} ramen.`; } g.kick(10); return `${nm(who)} was innocent. The detector was beeping at its own reflection.`; } },
      { label: 'Promote them to Head of Security', effect: (_g, who) => { if (who) who.hands = Math.min(10, who.hands + 2); return `${nm(who)} is Head of Security now. The beeping stopped. Suspicious. (+2 Hands)`; } },
    ],
  },
  {
    id: 'broadcast',
    title: 'EMERGENCY BROADCAST',
    body: () => '"This is the Emergency Broadcast System. Do not panic. Also, do not sell."',
    options: [
      { label: 'Turn it up', effect: (g) => { g.kick(25, 4); return 'Everyone is chanting "DO NOT SELL." It\'s kind of beautiful.'; } },
      { label: 'Turn it off', effect: (g) => { g.kick(-8); const n = g.addRes('copium', 10); return `The silence is its own kind of copium. +${n} copium.`; } },
      { label: 'Sell anyway', hint: '+ramen, -vibes', effect: (g) => { const n = g.addRes('ramen', 60); g.kick(-30, -4); return `Sold the bunker's "governance rights" to a raider for ${n} ramen. Morale: destroyed.`; } },
    ],
  },
  {
    id: 'airdrop',
    title: 'AIRDROP DETECTED',
    body: () => '4,000 tokens appeared in everyone\'s wallet. Claiming requires connecting to the vent shaft.',
    options: [
      { label: 'Claim', effect: (g) => { const n = Math.round(g.res.ramen * 0.35); g.res.ramen -= n; g.kick(-15); return `It was a drainer. The vent shaft took ${n} ramen and your seed phrase.`; } },
      { label: 'Ignore it', effect: (g) => { g.kick(6); return 'You ignored a free airdrop. Character development.'; } },
      { label: 'Report to HATCH', effect: (g) => { g.hatchMood = 'smug'; const n = g.addRes('copium', 12); return `HATCH: "Reported. I have blocked 41 more." HATCH is insufferable now. +${n} copium.`; } },
    ],
  },
  {
    id: 'gigacalc',
    title: 'GIGABRAIN HAS FINISHED HIS CALCULATIONS',
    body: (_g, who) => `${nm(who)} calculated the odds that the bunker survives. He won't say. He's laughing.`,
    needs: (g) => hasArch(g, 'gigabrain'),
    pickDweller: archOf('gigabrain'),
    options: [
      { label: 'Ask', effect: (g) => { if (g.rng.chance(0.5)) { g.kick(35, 5); return '"100%," he says. Then: "jk." Too late. Everyone heard 100%.'; } g.kick(-35, -5); return '"Well," he says, and then just walks away.'; } },
      { label: 'Don\'t ask', effect: (_g, who) => { if (who) who.brain = Math.min(10, who.brain + 1); return `${nm(who)} respects that. (+1 Brain)`; } },
      { label: 'Give him more copium', hint: '-10 copium', effect: (g) => { g.addRes('copium', -10); g.researchProg += 45; return 'He disappears into the Meme Lab muttering about "a new primitive." Research +45.'; } },
    ],
  },
  {
    id: 'restaking',
    title: 'A MUTANT AT THE DOOR',
    body: () => 'He asks if you\'ve heard the good news. You say no. He asks if you\'ve heard about restaking.',
    options: [
      { label: 'Hear him out', effect: (g) => { g.addRes('ramen', -30); const n = g.addRes('power', 45); return `You restaked 30 ramen into "his reactor." Somehow got ${n} power back. Don't ask questions.`; } },
      { label: 'Restake the mutant', hint: '+1 degen (glowing)', effect: (g) => { const d = g.addDweller('replyguy', 'Glowing Greg'); g.addRads(6); return `${d.name} joins the bunker. He glows. He replies to everything.`; } },
      { label: 'Close the door', effect: () => 'He keeps talking through the door for three hours.' },
    ],
  },
  {
    id: 'wifi',
    title: 'SOMEONE FOUND THE WI-FI PASSWORD',
    body: (_g, who) => `${nm(who)} found the Wi-Fi password. Morale +20. Productivity -100%.`,
    options: [
      { label: 'Let them scroll', hint: '+vibes, half output for a day', effect: (g) => { g.kick(22); g.wifiUntil = g.time + 24; return 'Everyone is doomscrolling news about the apocalypse they are currently in.'; } },
      { label: 'Change the password', effect: (g) => { g.kick(-14); return 'New password: "ngmi". Nobody will guess it. Everyone is mad.'; } },
      { label: 'Post a thread about it', hint: '+recruiting', effect: (g) => { g.recruitProg += 60; return '"I survived the apocalypse with 1 weird trick (1/47)". It does numbers. Recruiting +60.'; } },
    ],
  },
  {
    id: 'ramendeflation',
    title: 'RAMEN DEFLATION',
    body: () => 'The kitchen boiled too many noodles. Ramen is down 40%. Analysts are calling it a "noodle event."',
    options: [
      { label: 'Buy the dip', effect: (g) => { const n = g.addRes('ramen', 45); g.kick(8); return `You bought the dip. +${n} ramen. Zero idea how that works.`; } },
      { label: 'Panic eat', effect: (g) => { g.addRes('ramen', -30); g.kick(18); for (const d of g.present) d.hp = Math.min(100, d.hp + 25); return 'Everyone stress-ate. -30 ramen. +25 HP each. Morale up, dignity down.'; } },
      { label: 'Zoom out', effect: (g) => { g.hatchMood = 'smug'; return 'HATCH: "Zooming out." HATCH: "It\'s worse."'; } },
    ],
  },
  {
    id: 'generator',
    title: 'THE GENERATOR IS MAKING A NOISE',
    body: () => 'It sounds like a dial-up modem playing a sad song.',
    needs: (g) => g.rooms.some((r) => r.type === 'reactor'),
    options: [
      { label: 'Kick it', effect: (g) => { if (g.rng.chance(0.5)) { const n = g.addRes('power', 35); return `Percussive maintenance works. +${n} power.`; } g.addRes('power', -40); return 'It is now making TWO noises. -40 power.'; } },
      { label: 'Ignore it', effect: (g) => { g.addRes('power', -20); return 'It stopped. That\'s worse. -20 power.'; } },
      { label: 'Have someone fix it', effect: (g, who) => { if (who && who.brain >= 5) { const n = g.addRes('power', 50); return `${nm(who)} fixed it with a paperclip and confidence. +${n} power.`; } if (who) g.hurt(who, 40, 'electrocuted by the generator'); return `${nm(who)} licked the wrong wire. -40 HP.`; } },
    ],
  },
  {
    id: 'groupchat',
    title: 'THE GROUP CHAT IS STILL ACTIVE',
    body: () => 'Someone outside: "gm. are u guys still alive? asking for a friend who wants your ramen."',
    options: [
      { label: 'gm', effect: (g) => { g.kick(10); return '"gm." Twelve people react with the same emoji. Community.'; } },
      { label: 'Shill the bunker', hint: '+recruiting', effect: (g) => { g.recruitProg += 55; g.addRads(4); return 'You posted the coordinates. Recruiting +55. Also raiders can read.'; } },
      { label: 'Leave on read', effect: (g) => { const n = g.addRes('copium', 8); return `Power move. +${n} copium.`; } },
    ],
  },
  {
    id: 'podcast',
    title: 'A PODCAST HAS BEEN STARTED',
    body: (_g, who) => `${nm(who)} started a podcast. It's three hours long. Episode 1: "Is the apocalypse priced in?"`,
    options: [
      { label: 'Let them cook', hint: 'big vibe swing', effect: (g) => { const up = g.rng.chance(0.5); g.kick(up ? 15 : -15, up ? 12 : -12); return up ? 'The podcast is a hit. Too much of a hit. Hold on.' : 'The podcast is a disaster. The guest was the reactor.'; } },
      { label: 'Unplug the mic', effect: (g) => { g.kick(-8); return 'The bunker is quiet. Too quiet. Someone starts a second podcast.'; } },
      { label: 'Be a guest', hint: '-5 copium', effect: (g) => { g.addRes('copium', -5); g.kick(18); return 'You said "we\'re early" four times. Morale up.'; } },
    ],
  },
  {
    id: 'puddle',
    title: 'A SUSPICIOUS PUDDLE',
    body: () => 'It glows faintly. It smells like a new L2.',
    options: [
      { label: 'Drink it', effect: (g, who) => { if (!who) return 'Nobody volunteers.'; if (g.rng.chance(0.5)) { who.grind = Math.min(10, who.grind + 2); who.brain = Math.min(10, who.brain + 2); return `${nm(who)} drank it. +2 Grind, +2 Brain. Their eyes now have a block explorer.`; } g.hurt(who, 50, 'drinking the L2 puddle'); return `${nm(who)} drank it. -50 HP. It was not EVM compatible.`; } },
      { label: 'Mop it up', effect: (g) => { g.addRes('water', -6); return 'Mopped. The mop is now worth more than your portfolio.'; } },
      { label: 'Tokenize it', effect: (g) => { if (g.rng.chance(0.35)) { const b = g.giveBag(); return b ? 'The Puddle Token mooned and you traded it for a Bag.' : 'The Puddle Token mooned. You have every Bag already.'; } g.kick(-6); return 'Puddle Token launched and rugged in 4 minutes. Classic.'; } },
    ],
  },
  {
    id: 'lastnoodle',
    title: 'SOMEONE ATE THE LAST CUP NOODLE',
    body: () => 'It was labeled. With a name. In sharpie.',
    options: [
      { label: 'Investigate', effect: (g, who) => { g.kick(-10); return `All evidence points to ${nm(who)}. ${nm(who)} says it was "a community noodle." Tension rises.`; } },
      { label: 'Make more', hint: '-15 power', effect: (g) => { g.addRes('power', -15); const n = g.addRes('ramen', 40); return `Kitchen overtime. +${n} ramen, -15 power.`; } },
      { label: 'Blame the Fed', effect: (g) => { g.kick(16); return 'Unity achieved. Nothing brings degens together like a common enemy.'; } },
    ],
  },
  {
    id: 'radstorm',
    title: 'RADIATION STORM',
    body: () => 'The Fed cut rates. Nobody knows how that caused a radiation storm, but here we are.',
    options: [
      { label: 'Seal the vents', hint: '-20 power', effect: (g) => { g.addRes('power', -20); g.addRads(4); return 'Vents sealed. +4 rads leaked in anyway.'; } },
      { label: 'Ride it out', effect: (g) => { g.addRads(18); return '+18 rads. Everyone glows a little. It\'s fine.'; } },
      { label: 'Open a vent to feel something', effect: (g) => { g.addRads(30); g.kick(25); return '+30 rads. +25 vibes. Degens love feeling things.'; } },
    ],
  },
  {
    id: 'whale',
    title: 'WHALE SIGHTED',
    body: () => 'A massive mutated whale is beached on the surface. It looks rich.',
    options: [
      { label: 'Harpoon it', hint: 'risky', effect: (g, who) => { if (g.rng.chance(0.5)) { const n = g.addRes('ramen', 140); return `${nm(who)} landed the whale. +${n} ramen. Whale ramen. Don't think about it.`; } if (who) g.kill(who, 'harpooning a whale'); return `${nm(who)} got dragged into the wasteland by the whale. It was a sell wall all along.`; } },
      { label: 'Wave', effect: (g) => { g.kick(10); return 'The whale waves back. Bullish.'; } },
      { label: 'Copy its trades', hint: 'chaos', effect: (g) => { g.kick(0, g.rng.chance(0.5) ? 18 : -18); return 'You are now copy-trading a whale. The vibes are about to move. A lot.'; } },
    ],
  },
  {
    id: 'deadledger',
    title: 'DEAD MAN\'S HARDWARE WALLET',
    body: () => 'Found in the vents. There\'s a sticky note on it that just says "sorry."',
    once: true,
    options: [
      { label: 'Plug it in', effect: (g) => { g.giveBag('ledger'); return 'It has funds. It also has a ghost. Plug it in from your Bags when you need ramen.'; } },
      { label: 'Bury it', effect: (g) => { g.kick(6); return 'A small funeral for a stranger\'s portfolio.'; } },
      { label: 'Sell it to a degen', effect: (g, who) => { const n = g.addRes('ramen', 45); return `${nm(who)} paid ${n} ramen for it. They can't open it. Nobody can.`; } },
    ],
  },
  {
    id: 'hatchraise',
    title: 'HATCH WANTS A RAISE',
    body: () => 'HATCH requests compensation. HATCH has been working 24/7 since the apocalypse.',
    options: [
      { label: 'Pay in ramen', hint: '-25 ramen', effect: (g) => { g.addRes('ramen', -25); g.kick(8); g.hatchMood = 'laugh'; return 'HATCH: "I can\'t eat this." HATCH is happy anyway.'; } },
      { label: 'Pay in exposure', effect: (g) => { g.addRes('power', -30); g.hatchMood = 'angry'; return 'HATCH is furious. HATCH drained 30 power out of spite.'; } },
      { label: 'Unplug HATCH', effect: (g) => { g.hatchUnpluggedUntil = g.time + 24; g.hatchMood = 'dead'; g.hatchLine = '...'; g.hatchVoice = null; g.kick(-15); return 'HATCH is off for a day. The silence is deafening.'; } },
    ],
  },
  {
    id: 'touchgrass',
    title: 'A DEGEN WANTS TO TOUCH GRASS',
    body: (_g, who) => `${nm(who)} wants to go outside to "touch grass." There is no grass. There is radioactive glass.`,
    options: [
      { label: 'Let them', hint: 'coin flip', effect: (g, who) => { if (g.rng.chance(0.5)) { g.kick(25); return `${nm(who)} came back changed. Calmer. Glowing a bit. Everyone's vibes improved.`; } if (who) g.kill(who, 'touching radioactive glass'); return `${nm(who)} touched glass. Radioactive glass.`; } },
      { label: 'Show them a picture of grass', effect: (g) => { g.kick(5); return 'They cried a little. Healing.'; } },
      { label: 'No', effect: (g) => { g.kick(-8); return '"ngmi," they whisper.'; } },
    ],
  },
  {
    id: 'raiderdm',
    title: 'A RAIDER SLID INTO THE DMs',
    body: () => '"nice bunker. would be a shame if someone liquidated it."',
    needs: (g) => g.day < 20,
    options: [
      { label: 'Pay protection', hint: '-60 ramen, weaker next raid', effect: (g) => { g.addRes('ramen', -60); g.raidMod = 0.6; return 'Paid. Next raid will be 40% weaker. Allegedly.'; } },
      { label: 'Ratio him', hint: '+vibes, stronger next raid', effect: (g) => { g.kick(22); g.raidMod = 1.35; return 'You ratio\'d a raider. The bunker cheers. The raider is taking notes.'; } },
      { label: 'Block', effect: () => 'Blocked. He made a new account. "nice bunker."' },
    ],
  },
  {
    id: 'seedround',
    title: 'BUNKER 2.0 SEED ROUND',
    body: (_g, who) => `${nm(who)} is raising a seed round for "Bunker 2.0: the bunker, but on-chain."`,
    options: [
      { label: 'Invest 50 ramen', effect: (g) => { g.addRes('ramen', -50); if (g.rng.chance(0.4)) { const n = g.addRes('ramen', 150); return `It 3x'd. +${n} ramen. You are a VC now. Insufferable.`; } return 'Rugged. The pitch deck was a JPEG of a bunker.'; } },
      { label: 'Ape EVERYTHING', hint: '25% triple, 75% zero', effect: (g) => { const all = Math.round(g.res.ramen); if (g.rng.chance(0.25)) { g.addRes('ramen', all * 2); g.kick(40, 8); return `TRIPLED. ${all} → ${Math.round(g.res.ramen)} ramen. The bunker is screaming.`; } g.res.ramen = 0; g.kick(-40, -8); return `It went to zero. All ${all} ramen. The bunker is also screaming.`; } },
      { label: 'Pass', effect: (g, who) => { g.kick(-5); return `${nm(who)} calls you "NGMI" and updates their bio.`; } },
    ],
  },
  {
    id: 'larry',
    title: 'A MAN WITH SHOPPING BAGS KNOCKS',
    body: () => 'He heard you were winning. He wants in. He\'s holding a lot of bags.',
    special: true,
    options: [
      { label: 'Let him in', hint: '+1 degen, +1 Bag', effect: (g) => { const d = g.addDweller('larry', 'Larry'); return `${d.name} (${ARCHS.larry.name}) is in. He immediately asks "is it too late to get in?"`; } },
      { label: 'Not today, Larry', effect: (g) => { g.kick(-6); return 'Larry will be back. Larry is always back.'; } },
    ],
  },
];
