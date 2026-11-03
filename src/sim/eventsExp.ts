// Expedition return cards: when a degen climbs back in, sometimes they bring a decision
// with them. Opened by the expedition code with the returning degen as `who`.
import type { CardDef } from './events';
import type { Dweller } from './types';

const nm = (who: Dweller | null) => who?.name ?? 'Someone';

/** Keyed by location id. Each one is only ever opened by its own location. */
export const EXPEDITION_CARDS: Record<string, CardDef> = {
  exchange: {
    id: 'exp-exchange',
    title: 'A COLD WALLET IN THE RUBBLE',
    special: true,
    body: (_, who) => `${nm(who)} dug a hardware wallet out of the delisted exchange's lobby. There's a sticky note on it: "PIN is my birthday". Nobody knows whose birthday.`,
    options: [
      {
        label: 'Brute-force the PIN',
        hint: 'jackpot or bricked',
        effect: (g, who) => {
          if (g.rng.chance(0.35)) {
            const n = g.addRes('ramen', g.rng.int(90, 160));
            g.kick(10);
            return `Third try: 0420. The wallet held ${n} ramen worth of a coin that still trades somewhere. +${n} 🍜`;
          }
          g.kick(-8);
          if (who) g.hurt(who, 10, 'a hardware wallet self-destruct');
          return `It wiped itself after three tries, then made a sound like a tiny scream. ${nm(who)} -10 HP. Morale down.`;
        },
      },
      {
        label: 'Trade it to HATCH',
        hint: '+copium, safe',
        effect: (g) => {
          const n = g.addRes('copium', 25);
          return `HATCH accepts the wallet "for safekeeping" and dispenses ${n} copium. It will never mention the wallet again. +${n} 💊`;
        },
      },
      {
        label: 'Wear it around the neck',
        hint: 'maybe a Bag',
        effect: (g) => {
          if (g.rng.chance(0.4) && g.giveBag('hwnecklace')) return 'It fits perfectly. It feels like protection. It IS protection: Hardware Wallet Necklace acquired.';
          g.kick(4);
          return 'It looks great. It does nothing. Morale up slightly, because drip is drip.';
        },
      },
    ],
  },
  mine: {
    id: 'exp-mine',
    title: 'THE RIGS ARE STILL MINING',
    special: true,
    body: (_, who) => `The abandoned mining farm is still running. Nobody is getting paid. The fans sound like a jet engine of pure denial. ${nm(who)} wants to do something about it.`,
    options: [
      {
        label: 'Carry a rig home',
        hint: '+power, heavy',
        effect: (g, who) => {
          const n = g.addRes('power', 70);
          if (who) g.hurt(who, 15, 'carrying a mining rig down a porta-potty');
          return `${nm(who)} hauled a rig down the shaft and plugged it into the reactor backwards. It works. +${n} ⚡, -15 HP.`;
        },
      },
      {
        label: 'Join the mining pool',
        hint: 'go back out, more loot',
        effect: (g, who) => {
          const n = g.addRes('ramen', g.rng.int(30, 70));
          g.addRads(3);
          return `${nm(who)} pointed the hashrate at a pool that pays in ramen. Payout: ${n} ramen. Side effect: everyone glows a little. +${n} 🍜, +3 ☢`;
        },
      },
      {
        label: 'Unplug them. Let them rest.',
        hint: 'morale',
        effect: (g) => {
          g.kick(12);
          return 'The fans spin down. It is quiet for the first time since 2017. Someone in the bunker cries. Morale up.';
        },
      },
    ],
  },
  peg: {
    id: 'exp-peg',
    title: 'ONE MAN IS HOLDING THE PEG',
    special: true,
    body: (_, who) => `At the collapsed stablecoin, a man in a suit stands in the rubble holding a sign: "$1.00". He has been there since the depeg. ${nm(who)} brought him a snack.`,
    options: [
      {
        label: 'Arbitrage him',
        hint: '+water, a little evil',
        effect: (g) => {
          const n = g.addRes('water', 45);
          g.kick(-4);
          return `You bought his water at $0.97 and sold it back to him at $1.00. He thanked you. +${n} 💧. Morale down slightly, because you know what you did.`;
        },
      },
      {
        label: 'Invite him in',
        hint: '+1 degen',
        effect: (g) => {
          const d = g.addDweller('vc', 'Peg Guy', false);
          return `${d.name} agrees to come down, as long as the bunker stays "fully backed". He keeps holding the sign indoors.`;
        },
      },
      {
        label: 'Tell him it\'s over',
        hint: 'copium',
        effect: (g) => {
          const n = g.addRes('copium', 15);
          return `He doesn't believe you. He gives you his entire copium stash to prove he doesn't need it. +${n} 💊`;
        },
      },
    ],
  },
  mansion: {
    id: 'exp-mansion',
    title: 'THE RING LIGHT IS STILL ON',
    special: true,
    body: (_, who) => `In the influencer's bunker mansion, a livestream is still running. Zero viewers. The influencer is mid-sentence: "...and that's why this is the bottom." ${nm(who)} has been watching for an hour.`,
    options: [
      {
        label: 'Recruit the influencer',
        hint: '+1 degen, loud',
        effect: (g) => {
          const d = g.addDweller('influencer', undefined, false);
          g.kick(6);
          return `${d.name} joins the bunker and immediately asks where the good lighting is. Morale up. Productivity unclear.`;
        },
      },
      {
        label: 'Loot the sponsored merch',
        hint: '+ramen, +copium',
        effect: (g) => {
          const a = g.addRes('ramen', 40);
          const b = g.addRes('copium', 15);
          return `Forty cases of a ramen brand that paid for a shoutout, plus a "mental clarity" supplement that is just copium. +${a} 🍜, +${b} 💊`;
        },
      },
      {
        label: 'Leave a like',
        hint: 'karma',
        effect: (g) => {
          g.kick(8);
          return 'One viewer. The influencer starts crying on stream. You feel like a good person for the first time since the bombs. Morale up.';
        },
      },
    ],
  },
  gz: {
    id: 'exp-gz',
    title: 'A GLOWING AIRDROP CRATE',
    special: true,
    body: (_, who) => `At Ground Zero, ${nm(who)} found a crate stenciled "AIRDROP SEASON 3, ELIGIBLE WALLETS ONLY". It is humming. It is warm. It is, frankly, a little too green.`,
    options: [
      {
        label: 'Open it',
        hint: 'a Bag or rads',
        effect: (g, who) => {
          if (g.rng.chance(0.55)) {
            const b = g.giveBag();
            if (b) return 'Inside: a Bag, still in the packaging. You were eligible after all.';
          }
          g.addRads(8);
          if (who) g.hurt(who, 20, 'an unclaimed airdrop');
          return `Inside: pure radiation and a note saying "check back next season". +8 ☢, ${nm(who)} -20 HP.`;
        },
      },
      {
        label: 'Sell the claim to a farmer',
        hint: '+ramen',
        effect: (g) => {
          const n = g.addRes('ramen', 60);
          return `A passing airdrop farmer paid ${n} ramen for the crate, sight unseen. Somewhere, a man is about to have a very bad day. +${n} 🍜`;
        },
      },
      {
        label: 'Leave it. It\'s a honeypot.',
        hint: 'nothing happens',
        effect: (g) => {
          g.kick(3);
          return 'Wise. Rug Detectors in the bunker beep approvingly. Nobody is sure they have ever done that before.';
        },
      },
    ],
  },
  rival: {
    id: 'exp-rival',
    title: 'THEY HAVE A PORTA-POTTY TOO',
    special: true,
    body: (_, who) => `${nm(who)} found another bunker. Same porta-potty entrance, different burger joint. Inside: six degens and a monitor that keeps saying "gn". They have ramen. They have not noticed ${nm(who)} yet.`,
    options: [
      {
        label: 'Take everything',
        hint: 'big ramen, you are the raiders now',
        effect: (g) => {
          const n = g.addRes('ramen', g.rng.int(100, 170));
          g.stats.bunkersRaided++;
          g.kick(-6);
          return `You took ${n} ramen and their monitor's dignity. Congratulations. You are now the raiders. +${n} 🍜`;
        },
      },
      {
        label: 'Propose a merger',
        hint: '+1 degen, no loot',
        effect: (g) => {
          const d = g.addDweller(g.rollArch(), undefined, false);
          g.kick(6);
          return `Their best degen, ${d.name}, defects to your bunker for "better tokenomics". A friendly acquisition.`;
        },
      },
      {
        label: 'Leave a note: "gm"',
        hint: 'morale',
        effect: (g) => {
          g.kick(10);
          return 'Their monitor replies "gm". It is the most wholesome thing that has happened since the bombs. Morale up.';
        },
      },
    ],
  },
};
