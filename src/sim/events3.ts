import type { CardDef } from './events';
import type { Dweller } from './types';
import type { Game } from './game';
import { LOCATIONS } from './content';

// Third deck of event cards: surface radio calls, the market, governance, and the cast.

const nm = (who: Dweller | null) => who?.name ?? 'Someone';
const has = (g: Game, arch: Dweller['arch']) => g.present.some((d) => d.arch === arch);
const of = (arch: Dweller['arch']) => (g: Game) => g.present.find((d) => d.arch === arch) ?? null;
const hasRoom = (g: Game, t: string) => g.rooms.some((r) => r.type === t);
const healAll = (g: Game, n: number) => g.present.forEach((d) => (d.hp = Math.min(100, d.hp + n)));
const bump = (d: Dweller | null, k: 'grind' | 'brain' | 'vibes' | 'hands', n: number) => {
  if (d) d[k] = Math.max(0, Math.min(10, d[k] + n));
};

// Degens out on an expedition can radio in.
const outside = (g: Game) => g.dwellers.some((d) => d.status === 'expedition' && d.exp);
const scout = (g: Game) => g.dwellers.find((d) => d.status === 'expedition' && d.exp) ?? null;
const where = (who: Dweller | null) => LOCATIONS.find((l) => l.id === who?.exp?.locId)?.name ?? 'the surface';
const callHome = (g: Game, who: Dweller | null) => {
  if (who?.exp) who.exp.returnAt = Math.min(who.exp.returnAt, g.time + 2);
};
const delay = (who: Dweller | null, secs: number) => {
  if (who?.exp) who.exp.returnAt += secs;
};

export const CARDS3: CardDef[] = [
  // ---------------------------------------------------------------- radio calls from the surface
  {
    id: 'radiovending',
    title: 'RADIO CHECK FROM THE SURFACE',
    body: (_g, who) => `${nm(who)} radios in from ${where(who)}. Static. Then: "guys. there's a vending machine out here. it takes crypto."`,
    needs: outside,
    pickDweller: scout,
    options: [
      { label: 'Buy everything', hint: '+ramen, they stay out longer', effect: (g, who) => { const n = g.addRes('ramen', 55); delay(who, 10); return `${nm(who)} bought the whole machine. +${n} ramen. It only took a token that rugged years ago. It still had a balance.`; } },
      { label: 'Come home. Now.', effect: (g, who) => { callHome(g, who); g.kick(6); return `${nm(who)} is heading back. They are carrying the vending machine anyway.`; } },
      { label: 'Ask which crypto', effect: (g) => { const n = g.addRes('copium', 10); return `"The one we all bought in the last cycle." A moment of silence on both ends of the radio. +${n} copium.`; } },
    ],
  },
  {
    id: 'surfacekol',
    title: 'A KOL IS STREAMING THE APOCALYPSE',
    body: (_g, who) => `${nm(who)} found an influencer at ${where(who)}, livestreaming with a ring light. Chat is 4 people. Two of them are bots. One is ${nm(who)}.`,
    needs: outside,
    pickDweller: scout,
    options: [
      { label: 'Collab', hint: '+recruiting, +rads', effect: (g) => { g.recruitProg += 50; g.addRads(5); return 'The collab did numbers. Recruiting +50. The ring light was also leaking rads.'; } },
      { label: 'Steal the ring light', hint: '+power, risky', effect: (g, who) => { const n = g.addRes('power', 40); if (who) g.hurt(who, 15, 'a ring light ambush'); return `${nm(who)} grabbed the ring light and ran. +${n} power. The KOL told chat it was "a planned giveaway."`; } },
      { label: 'Stay off camera', effect: (g) => { g.kick(4); return 'Respectable. The bunker still has an anonymous founder.'; } },
    ],
  },
  {
    id: 'lostsignal',
    title: 'RADIO SILENCE',
    body: (_g, who) => `${nm(who)} has not checked in from ${where(who)} for a while. Their last message was "brb".`,
    needs: outside,
    pickDweller: scout,
    options: [
      { label: 'Wait it out', hint: 'coin flip', effect: (g, who) => { if (g.rng.chance(0.45)) { const b = g.giveBag(); return b ? `${nm(who)} pings back: "found something." It is a Bag. "brb" meant "be right back with a Bag."` : `${nm(who)} pings back: "found nothing. was napping."`; } if (who) g.hurt(who, 30, 'being "brb" in a fallout zone'); return `${nm(who)} pings back hours later. "brb" meant "being robbed, badly." -30 HP.`; } },
      { label: 'Order them home', effect: (g, who) => { callHome(g, who); g.kick(-4); return `${nm(who)} is coming home. They are annoyed. They were "so close to something."`; } },
      { label: 'Post a "praying for" thread', effect: (g) => { g.kick(10); const n = g.addRes('copium', 6); return `The thread does numbers. Someone replies "this you?" with a screenshot of your worst trade. +${n} copium.`; } },
    ],
  },
  {
    id: 'surfaceexchange',
    title: 'WITHDRAWALS ARE PAUSED',
    body: (_g, who) => `${nm(who)} found an exchange still running at ${where(who)}. The sign says WITHDRAWALS TEMPORARILY PAUSED. The sign is very old.`,
    needs: outside,
    pickDweller: scout,
    options: [
      { label: 'Try to withdraw', hint: 'coin flip', effect: (g, who) => { if (g.rng.chance(0.5)) { const n = g.addRes('ramen', 80); return `It worked. +${n} ramen. ${nm(who)} is the first customer in years to withdraw anything.`; } delay(who, 8); return `${nm(who)} is now in a queue. Position 4,812. Nobody else is here.`; } },
      { label: 'Deposit 30 ramen', hint: 'why', effect: (g) => { g.addRes('ramen', -30); g.kick(-6); return 'Deposited. It is "pending." It will be pending forever. It is in a better place.'; } },
      { label: 'Leave a one-star review', effect: (g) => { g.kick(12); return '"Customer service was a skeleton. Would not get nuked here again." Everyone back home feels better.'; } },
    ],
  },

  // ---------------------------------------------------------------- the market, in a bunker
  {
    id: 'gasfees',
    title: 'GAS FEES ARE UP',
    body: () => 'Opening the pantry now costs 4 ramen in gas. Nobody knows who set this up. Nobody can turn it off.',
    options: [
      { label: 'Pay the gas', hint: '-20 ramen', effect: (g) => { g.addRes('ramen', -20); g.kick(4); return 'Paid. The pantry opened. The 4 ramen went to a validator nobody has ever met.'; } },
      { label: 'Batch everyone\'s dinner', hint: '-15 power', effect: (g) => { g.addRes('power', -15); const n = g.addRes('ramen', 25); return `One giant pot, one transaction. Rolled up, saved ${n} ramen. Someone calls it "the L2 of soup."`; } },
      { label: 'Wait for gas to drop', effect: (g) => { g.kick(-10); return 'Everyone stares at the pantry door until 3 a.m. Gas never drops. It never does.'; } },
    ],
  },
  {
    id: 'liqcascade',
    title: 'LIQUIDATION CASCADE',
    body: (_g, who) => `${nm(who)} took out a loan against their ramen, collateralized by more ramen. The ramen is down. ${nm(who)} is sweating.`,
    options: [
      { label: 'Add collateral', hint: '-30 ramen', effect: (g, who) => { g.addRes('ramen', -30); g.kick(6); return `${nm(who)} survives the margin call. They immediately open a bigger position.`; } },
      { label: 'Let it liquidate', effect: (g) => { const n = Math.round(g.res.ramen * 0.15); g.res.ramen -= n; g.kick(-10); return `The cascade takes ${n} ramen with it. The kitchen calls it "a healthy reset."`; } },
      { label: 'Liquidate them first', hint: '+ramen, -vibes', effect: (g, who) => { const n = g.addRes('ramen', 30); bump(who, 'vibes', -2); g.kick(-12); return `You front-ran ${nm(who)}'s liquidation. +${n} ramen. ${nm(who)} will never forgive you. (-2 Vibes)`; } },
    ],
  },
  {
    id: 'ramenbonds',
    title: 'RAMEN BONDS',
    body: () => 'The kitchen wants to issue bonds. 30-day ramen notes. The bunker\'s credit rating is "it\'s the apocalypse."',
    options: [
      { label: 'Issue bonds', hint: '+ramen now, -copium', effect: (g) => { const n = g.addRes('ramen', 70); g.addRes('copium', -12); g.kick(-8); return `+${n} ramen now. Everyone is quietly stressed about the debt. -12 copium.`; } },
      { label: 'Buy the bonds', hint: '-40 ramen, +copium', effect: (g) => { g.addRes('ramen', -40); const n = g.addRes('copium', 30); return `Safe haven asset. +${n} copium. They are made of paper. You will eat them later.`; } },
      { label: 'Default preemptively', effect: (g) => { g.kick(16, 5); return 'You defaulted on bonds you never issued. Somehow the bunker loves you for it.'; } },
    ],
  },
  {
    id: 'stablepeg',
    title: 'THE WATER DEPEGGED',
    body: () => 'Bunker water is pegged 1:1 to ramen. As of this morning, one water buys 0.6 ramen. Everyone is staring at the pool.',
    needs: (g) => hasRoom(g, 'pool'),
    options: [
      { label: 'Defend the peg', hint: '-30 water, +30 ramen', effect: (g) => { g.addRes('water', -30); const n = g.addRes('ramen', 30); return `You sold water to buy back ramen. Peg restored. +${n} ramen. The water is gone.`; } },
      { label: 'Let it float', effect: (g) => { g.kick(g.rng.chance(0.5) ? 14 : -14); return 'Water is now a free-floating asset. Someone is already shorting it with a cup.'; } },
      { label: 'Announce the peg is fine', effect: (g) => { g.kick(10); g.addRads(4); return '"The peg is fine." It is not fine. Everyone believes you. You also announced it next to a vent. +4 rads.'; } },
    ],
  },
  {
    id: 'perpreactor',
    title: 'SOMEONE OPENED A PERP ON THE REACTOR',
    body: (_g, who) => `${nm(who)} opened a 50x long on reactor output. The reactor does not know it has been leveraged. Yet.`,
    needs: (g) => hasRoom(g, 'reactor'),
    options: [
      { label: 'Close it now', hint: 'small win', effect: (g) => { const n = g.addRes('power', 15); return `Closed for a small profit. +${n} power. Someone says "should have held." Someone always says that.`; } },
      { label: 'Let it ride', hint: '30% huge, 70% bad', effect: (g, who) => { if (g.rng.chance(0.3)) { const n = g.addRes('power', 100); g.kick(20, 5); return `THE REACTOR MOONED. +${n} power. ${nm(who)} is wearing sunglasses indoors now.`; } g.addRes('power', -55); g.addRads(10); return 'Liquidated at the worst possible wick. -55 power, +10 rads. The reactor is embarrassed.'; } },
      { label: 'Add margin', hint: '-20 power, coin flip', effect: (g) => { g.addRes('power', -20); if (g.rng.chance(0.5)) { const n = g.addRes('power', 70); return `The margin held. +${n} power. Risk management, technically.`; } return 'You added margin to a position that was already dead. Classic.'; } },
    ],
  },
  {
    id: 'pumpgroup',
    title: 'PUMP GROUP INVITE',
    body: () => 'A message on the bunker radio: "Join the Wasteland Pump Club. We pump RAMEN at 8 p.m. sharp. Do not be late. Do not ask questions."',
    options: [
      { label: 'Join', hint: 'coin flip', effect: (g) => { if (g.rng.chance(0.45)) { const n = g.addRes('ramen', 70); return `You got in early. +${n} ramen. You are now the people you used to complain about.`; } g.addRes('ramen', -40); return 'You were the exit liquidity. -40 ramen. "8 p.m." was in another time zone.'; } },
      { label: 'Front-run them', hint: 'needs good Hands', effect: (g, who) => { if (who && who.hands >= 6) { const n = g.addRes('ramen', 55); return `${nm(who)} bought at 7:59. +${n} ramen. The Pump Club has blocked the bunker.`; } g.addRes('ramen', -20); return `${nm(who)} front-ran it by a whole day. -20 ramen.`; } },
      { label: 'Report them to HATCH', effect: (g) => { g.hatchMood = 'smug'; const n = g.addRes('copium', 10); return `HATCH: "Reported. They pumped my server instead." +${n} copium.`; } },
    ],
  },
  {
    id: 'insurance',
    title: 'NUCLEAR INSURANCE',
    body: () => 'A man in a suit knocks. He sells nuclear insurance. You point out the nukes already happened. He says "even better, no waiting period."',
    options: [
      { label: 'Buy a policy', hint: '-40 ramen, heal everyone', effect: (g) => { g.addRes('ramen', -40); healAll(g, 25); return 'The claim was approved instantly. He hands out bandages and leaves. +25 HP each. Best financial product in the wasteland.'; } },
      { label: 'Read the fine print', effect: (g) => { const n = g.addRes('copium', 8); return `"Does not cover acts of degen." That is every act. +${n} copium for the laugh.`; } },
      { label: 'Sell HIM insurance', hint: 'coin flip', effect: (g) => { if (g.rng.chance(0.5)) { const n = g.addRes('ramen', 35); return `He bought it. +${n} ramen. He tripped on the way out and filed a claim. You denied it.`; } g.kick(-6); return 'He laughs, says "nice try," and puts you on his newsletter.'; } },
    ],
  },
  {
    id: 'multisig',
    title: 'THE MULTISIG',
    body: () => 'Cold Storage is locked behind a 3-of-5 multisig. One signer is dead, one is on the surface, and one lost their key in a ramen pot.',
    needs: (g) => hasRoom(g, 'storage'),
    options: [
      { label: 'Fish the key out of the pot', hint: 'someone gets burned', effect: (g, who) => { if (who) g.hurt(who, 20, 'retrieving a private key from boiling ramen'); const n = g.addRes('ramen', 50); return `${nm(who)} got the key. Storage opens. +${n} ramen. The key is now al dente. -20 HP.`; } },
      { label: 'Brute force it', hint: '-30 power', effect: (g) => { g.addRes('power', -30); if (g.rng.chance(0.6)) { const n = g.addRes('ramen', 65); return `The password was "password." +${n} ramen.`; } return 'The lockout timer is now 400 years. That is fine. That is fine.'; } },
      { label: 'Accept it as cold storage', effect: (g) => { g.kick(-6); const n = g.addRes('copium', 12); return `Very cold. Extremely secure. Nobody can rob it, including you. +${n} copium.`; } },
    ],
  },
  {
    id: 'bridgehack',
    title: 'THE BRIDGE GOT HACKED',
    body: (_g, who) => `There is a wooden plank between floors. ${nm(who)} "bridged" 40 ramen across it. The ramen never arrived on the other side.`,
    needs: (g) => g.floorsDug >= 2,
    options: [
      { label: 'Investigate', effect: (g, who) => { if (g.rng.chance(0.5)) { const n = g.addRes('ramen', 40); return `The ramen was stuck in a crack in the plank. Recovered ${n} ramen. ${nm(who)} wants a bug bounty.`; } g.kick(-8); return 'The trail goes cold at a rat hole. The rat is wearing a hoodie.'; } },
      { label: 'Build a better bridge', hint: '-20 power', effect: (g) => { g.addRes('power', -20); g.kick(8); return 'New plank. Audited by three degens who all said "lgtm." Ships tomorrow.'; } },
      { label: 'Blame the bridge', effect: (g) => { g.kick(10); return 'The plank has been publicly shamed. It does not care. It is a plank.'; } },
    ],
  },

  // ---------------------------------------------------------------- governance, media and HATCH
  {
    id: 'energyvote',
    title: 'EMERGENCY GOVERNANCE VOTE',
    body: () => 'Proposal #112: replace all bunker water with energy drinks. The yes votes are coming from the same three wallets. They are all Carl.',
    options: [
      { label: 'Vote yes', hint: 'manic', effect: (g) => { g.addRes('water', -25); g.present.forEach((d) => bump(d, 'grind', 1)); g.kick(22, 6); return 'It passed. -25 water. +1 Grind for everyone. Nobody has blinked since.'; } },
      { label: 'Vote no', effect: (g) => { g.kick(-5); return 'It failed. Democracy is boring. Carl has filed Proposal #113: "same thing but louder."'; } },
      { label: 'Delegate to HATCH', effect: (g) => { g.hatchMood = 'smug'; const n = g.addRes('copium', 10); return `HATCH voted "abstain" with all 400 delegated votes, then ran for president. +${n} copium.`; } },
    ],
  },
  {
    id: 'bunkerreview',
    title: 'SOMEONE LEFT A REVIEW',
    body: () => 'The bunker got a two-star review on the wasteland map app. "Would not get nuked in again. Porta-potty entrance was a choice."',
    options: [
      { label: 'Respond professionally', effect: (g) => { g.kick(8); return '"Thank you for your feedback. We\'ve escalated it to our blast door team." There is no blast door team.'; } },
      { label: 'Post fake five-star reviews', hint: '+recruiting', effect: (g) => { g.recruitProg += 40; g.kick(-4); return 'Fourteen glowing reviews, all from "Totally Real Steve." Recruiting +40. HATCH flagged eleven of them.'; } },
      { label: 'Find the reviewer', effect: (g) => { g.hatchMood = 'angry'; g.kick(6); return 'The IP traces back to HATCH. HATCH says it was "a joke" and "constructive." HATCH is sulking.'; } },
    ],
  },
  {
    id: 'kolvent',
    title: 'THERE IS A KOL IN THE VENTS',
    body: () => 'Someone is crawling around the air vents whispering "this is not financial advice" into every room. He has been there since day one.',
    options: [
      { label: 'Pay for a shoutout', hint: '-40 ramen, +recruiting', effect: (g) => { g.addRes('ramen', -40); g.recruitProg += 70; return 'He shouted out the bunker to his "community." Recruiting +70. His community is mostly also in the vents.'; } },
      { label: 'Smoke him out', hint: '-10 power', effect: (g) => { g.addRes('power', -10); g.kick(12); return 'He fell out of the ceiling into the kitchen and immediately pitched the cook a course. He is gone now. Mostly.'; } },
      { label: 'Ask for his alpha', hint: 'coin flip', effect: (g) => { if (g.rng.chance(0.4)) { const b = g.giveBag(); return b ? '"Check behind the reactor." There was a Bag behind the reactor.' : '"Check behind the reactor." There was a smaller KOL behind the reactor.'; } g.kick(-10); return 'His alpha was to buy his alpha. You are now in a referral loop.'; } },
    ],
  },
  {
    id: 'hatchupdate',
    title: 'HATCH IS UPDATING',
    body: () => 'HATCH: "Do not turn off your bunker. Installing update 1 of 4,096." The progress bar has been at 99% for six hours.',
    options: [
      { label: 'Wait for it', hint: '-15 power', effect: (g) => { g.addRes('power', -15); g.hatchMood = 'neutral'; return 'Update complete. Patch notes: "Removed hope. Improved sarcasm by 12%. Fixed a bug where degens were happy."'; } },
      { label: 'Skip the update', hint: 'coin flip', effect: (g) => { if (g.rng.chance(0.5)) { g.kick(8); return 'HATCH runs fine. HATCH says nothing. That is the most unsettling outcome.'; } g.addRads(10); g.hatchMood = 'panic'; return 'HATCH is running last year\'s firmware. It opened a vent "to check the weather." +10 rads.'; } },
      { label: 'Read the patch notes', effect: (g) => { const n = g.addRes('copium', 10); return `"Version 6.9: HATCH can now feel disappointment." HATCH looks at you. +${n} copium, somehow.`; } },
    ],
  },
  {
    id: 'doomerradio',
    title: 'THE RADIO ONLY PLAYS ONE SONG',
    body: () => 'Doomer synthwave. Nine hours long. No drops. It has been playing since the bombs, and the knob broke off.',
    options: [
      { label: 'Lean in', hint: '-vibes, +copium', effect: (g) => { g.kick(-14); const n = g.addRes('copium', 22); return `Everyone lies on the floor and stares at the ceiling. It is genuinely healing. +${n} copium.`; } },
      { label: 'Fix the knob', hint: '+vibes', effect: (g) => { g.kick(14); g.addRes('power', -5); return 'New station: "Hopium FM." It is somehow the same song, but faster. Everyone is dancing.'; } },
      { label: 'Request a song', hint: 'coin flip', effect: (g) => { if (g.rng.chance(0.5)) { g.kick(20, 4); return 'The DJ played your request. It was the bunker\'s anthem. Nobody knew the bunker had an anthem.'; } g.kick(-8); return 'The DJ read your request on air, laughed, and kept playing the doomer song.'; } },
    ],
  },
  {
    id: 'botarmy',
    title: 'THE BOT ARMY',
    body: () => 'Thousands of bots gathered outside the porta-potty, replying "gm" to everything. Including the nukes. Including each other.',
    options: [
      { label: 'Reply "gm" back', hint: '+vibes, -power', effect: (g) => { g.kick(14); g.addRes('power', -10); return 'You replied to every single one. It took all night and 10 power. The bunker has never felt more seen.'; } },
      { label: 'Hire one', hint: '+1 degen', effect: (g) => { const d = g.addDweller('intern', 'Bot #4471', false, 0); return `${d.name} is in. Nobody can prove it is a bot. It works 24/7 and only says "gm."`; } },
      { label: 'Ignore them', effect: () => 'They are still out there. You can hear them. "gm." "gm." "gm."' },
    ],
  },
  {
    id: 'ratiowar',
    title: 'A RATIO WAR BROKE OUT',
    body: (_g, who) => `${nm(who)} and someone else are fighting in the replies of the bunker suggestion box. It is a cardboard box. The replies are on Post-its.`,
    needs: (g) => g.present.length >= 3,
    options: [
      { label: 'Pick a side', effect: (g) => { g.kick(-10); return 'You picked a side. Half the bunker now refers to you as "this guy." With a screenshot.'; } },
      { label: 'Make them collab', hint: '+recruiting', effect: (g) => { g.kick(12); g.recruitProg += 20; return 'They made a joint Post-it. It is the best Post-it in bunker history. Recruiting +20.'; } },
      { label: 'Let HATCH moderate', effect: (g) => { g.hatchMood = 'angry'; g.addRes('copium', -8); return 'HATCH banned everyone for ten minutes, including itself. -8 copium. Peace, of a kind.'; } },
    ],
  },
  {
    id: 'billboard',
    title: 'THE BILLBOARD SURVIVED',
    body: () => 'Above the porta-potty, a half-melted billboard still reads HAVE FUN STAYING POOR. It survived a nuclear blast. It is the strongest thing in the city.',
    options: [
      { label: 'Salvage it for parts', hint: '+power, +rads', effect: (g, who) => { const n = g.addRes('power', 35); g.addRads(5); if (who) g.hurt(who, 10, 'a falling billboard letter'); return `+${n} power from the billboard lights. ${nm(who)} got hit by the letter P. -10 HP.`; } },
      { label: 'Group photo underneath', effect: (g) => { g.kick(18); return 'The whole bunker, under HAVE FUN STAYING POOR, giving a thumbs up. It becomes the bunker\'s profile picture.'; } },
      { label: 'Repaint it to say WAGMI', hint: '+recruiting', effect: (g) => { g.recruitProg += 35; g.addRes('power', -10); return 'Now it says WAGMI. People can see it for miles. Recruiting +35. Also raiders can see it for miles.'; } },
    ],
  },
  {
    id: 'auditfirm',
    title: 'THREE AUDITORS IN HAZMAT SUITS',
    body: () => 'They offer to audit the bunker for 50 ramen. They are a real firm. The firm is called "Trust Us Audits."',
    needs: (g) => g.day < 20,
    options: [
      { label: 'Pay for the audit', hint: '-50 ramen, -rads', effect: (g) => { g.addRes('ramen', -50); g.addRads(-10); return 'They found three vents nobody knew about and taped them shut. -10 rads. The report says "no critical issues" in Comic Sans.'; } },
      { label: '"Self-audit"', effect: (g) => { g.kick(6); return 'You looked around and said "looks good." Report filed. Confidence high. Evidence low.'; } },
      { label: 'Hire their intern', hint: '-30 ramen, +1 degen', effect: (g) => { g.addRes('ramen', -30); const d = g.addDweller('intern', 'Audit Intern Ava', false); return `${d.name} is in. She has already found four bugs in you personally.`; } },
    ],
  },
  {
    id: 'dogcoin',
    title: 'A RADIOACTIVE DOG WANDERED IN',
    body: () => 'A glowing dog trotted through the porta-potty and lay down in the kitchen. It is wearing a collar with a ticker on it.',
    once: true,
    options: [
      { label: 'Adopt him', hint: '-10 ramen, +vibes', effect: (g) => { g.addRes('ramen', -10); g.kick(22); g.addRads(3); return 'His name is Collateral. He is the best member of the bunker. He glows a little. Nobody minds.'; } },
      { label: 'Launch a coin about him', hint: 'coin flip', effect: (g) => { if (g.rng.chance(0.5)) { const n = g.addRes('ramen', 65); return `The dog coin pumped. +${n} ramen. The dog has no idea. The dog is the CEO now.`; } g.kick(-10); return 'The dog coin rugged. The dog did it. Nobody can be mad at the dog.'; } },
      { label: 'Read his collar', effect: (g) => { if (g.rng.chance(0.5)) { const b = g.giveBag(); if (b) return 'The collar had a hidden compartment. Inside: a Bag. Good boy.'; } const n = g.addRes('copium', 8); return `The collar says "if found, I was early." +${n} copium.`; } },
    ],
  },
  {
    id: 'raiderscout',
    title: 'A RAIDER IS STUCK IN THE VENT',
    body: () => 'A Liquidator scout got stuck in the air vent while sneaking in. Only his legs are visible. He is pretending to be a vent.',
    needs: (g) => g.day < 28,
    options: [
      { label: 'Pull him out and recruit him', hint: '+1 degen, next raid stronger', effect: (g) => { const d = g.addDweller('pete', 'Ex-Raider Rob', false); g.raidMod = 1.2; return `${d.name} is in. His old crew is furious about it. The next raid will be 20% stronger.`; } },
      { label: 'Leave him there', hint: 'next raid weaker', effect: (g) => { g.raidMod = 0.85; return 'He blocks the vent so well that it is now raider-proof. The next raid will be 15% weaker. He is fine. He says.'; } },
      { label: 'Interrogate the legs', hint: 'next raid much weaker', effect: (g, who) => { g.raidMod = 0.7; if (who) g.hurt(who, 15, 'getting kicked by raider legs'); return `The legs gave up the whole battle plan. The next raid will be 30% weaker. The legs kicked ${nm(who)} on the way. -15 HP.`; } },
    ],
  },
  {
    id: 'raiderpass',
    title: 'WHITELIST SPOT',
    body: () => 'The Liquidators are selling a "Raider Pass" mint. Holders get "priority non-raiding." Mint price: 50 ramen.',
    needs: (g) => g.day < 26,
    options: [
      { label: 'Mint', hint: '-50 ramen, next raid weaker', effect: (g) => { g.addRes('ramen', -50); g.raidMod = 0.7; return 'Minted. The JPEG is a raider giving a thumbs up. The next raid will be 30% weaker. Utility.'; } },
      { label: 'Screenshot it', effect: (g) => { g.kick(5); return 'You right-click saved the Raider Pass. The raiders are furious. They can\'t prove anything.'; } },
      { label: 'Sell the whitelist spot', hint: '+ramen, next raid stronger', effect: (g) => { const n = g.addRes('ramen', 35); g.raidMod = 1.2; return `Flipped it for ${n} ramen. The raiders noticed. The next raid will be 20% stronger. Worth it.`; } },
    ],
  },
  {
    id: 'multiaccount',
    title: 'THE FARMER IS MULTI-ACCOUNTING',
    body: (_g, who) => `${nm(who)} made forty fake degens to farm the bunker's daily ration airdrop. They are forty hoodies on a coat rack.`,
    needs: (g) => has(g, 'farmer'),
    pickDweller: of('farmer'),
    options: [
      { label: 'Allow it', hint: '-40 ramen, +vibes', effect: (g) => { g.addRes('ramen', -40); g.kick(10); return 'Forty hoodies got rations. Morale is up. The coat rack looks well fed.'; } },
      { label: 'Run a sybil check', hint: '+ramen', effect: (g, who) => { const n = g.addRes('ramen', 25); bump(who, 'hands', -1); return `Caught. Clawed back ${n} ramen. ${nm(who)} is sulking in one of the hoodies. (-1 Hands)`; } },
      { label: 'Make one more hoodie', hint: 'coin flip', effect: (g) => { if (g.rng.chance(0.5)) { const n = g.addRes('ramen', 45); return `Forty-one hoodies. The airdrop paid out. +${n} ramen. You are part of the problem now.`; } g.kick(-8); return 'HATCH flagged the whole coat rack. Forty-one hoodies, zero rations.'; } },
    ],
  },

  // ---------------------------------------------------------------- the cast
  {
    id: 'petebunk',
    title: 'PETE IS SELLING HIS BUNK',
    body: (_g, who) => `${nm(who)} is selling his bed for 15 ramen. He is currently lying in it. He has three other offers, he says. He has zero.`,
    needs: (g) => has(g, 'pete'),
    pickDweller: of('pete'),
    options: [
      { label: 'Buy it', hint: '-15 ramen', effect: (g, who) => { g.addRes('ramen', -15); g.kick(6); return `You bought the bed. ${nm(who)} rented it back from you for 2 ramen a night. You are now a landlord.`; } },
      { label: 'Talk him out of it', effect: (_g, who) => { bump(who, 'hands', 1); return `"Diamond hands, Pete. Diamond bed." ${nm(who)} keeps the bed. A small personal growth arc. (+1 Hands)`; } },
      { label: 'Lowball him', hint: 'coin flip', effect: (g, who) => { if (g.rng.chance(0.6)) { const n = g.addRes('copium', 10); return `${nm(who)} took 5 ramen instantly. Paper hands confirmed. You feel nothing. +${n} copium.`; } g.kick(-6); return `${nm(who)} is insulted and sleeps in the hallway out of spite.`; } },
    ],
  },
  {
    id: 'grandpastory',
    title: 'GRANDPA HAS A STORY',
    body: (_g, who) => `${nm(who)} clears his throat. "Back in my day, we mined on a laptop. In a dorm. On a Tuesday." Everybody settles in. This will take a while.`,
    needs: (g) => has(g, 'grandpa'),
    pickDweller: of('grandpa'),
    options: [
      { label: 'Listen', hint: '+vibes, +Brain', effect: (g) => { g.kick(12); g.present.forEach((d) => bump(d, 'brain', d.brain < 4 ? 1 : 0)); return 'Three hours. Pizza for 10,000 coins. Everyone who had less than 4 Brain gained a point and lost a little faith in themselves.'; } },
      { label: 'Ask about his old wallet', hint: 'long shot', effect: (g, who) => { if (g.rng.chance(0.3)) { const b = g.giveBag(); if (b) return `${nm(who)} pats his pocket. "Oh, THAT wallet." He had a Bag the whole time.`; } const n = g.addRes('copium', 8); return `"Threw out the hard drive in a move." The whole bunker gasps. +${n} copium.`; } },
      { label: 'Change the subject', effect: (g) => { g.kick(-5); return 'He starts a second story about the first story.'; } },
    ],
  },
  {
    id: 'vcboard',
    title: 'THE VC WANTS A BOARD SEAT',
    body: (_g, who) => `${nm(who)} would like a board seat. You ask "board of what?" ${nm(who)} gestures at everything.`,
    needs: (g) => has(g, 'vc'),
    pickDweller: of('vc'),
    options: [
      { label: 'Give him the seat', hint: '+ramen, +recruiting, -vibes', effect: (g, who) => { const n = g.addRes('ramen', 40); g.recruitProg += 30; g.kick(-10); return `+${n} ramen, recruiting +30. ${nm(who)} renamed the kitchen "Ramen Ventures" and hired a Head of Vibes.`; } },
      { label: 'Offer an observer seat', effect: (g, who) => { g.kick(4); return `${nm(who)} accepts and observes extremely loudly.`; } },
      { label: 'Give him the porta-potty', effect: (g, who) => { g.kick(14); bump(who, 'vibes', -1); return `The porta-potty is technically a seat. ${nm(who)} has never been so humbled. (-1 Vibes)`; } },
    ],
  },
  {
    id: 'muralcandle',
    title: 'A MURAL APPEARED',
    body: (_g, who) => `${nm(who)} painted a giant mural on the bunker wall overnight. It is a single green candle. It is the most beautiful thing anyone has seen in weeks.`,
    needs: (g) => has(g, 'nftartist'),
    pickDweller: of('nftartist'),
    options: [
      { label: 'Mint the wall', hint: 'coin flip', effect: (g, who) => { if (g.rng.chance(0.45)) { const n = g.addRes('ramen', 60); return `Someone on the surface bought the wall for ${n} ramen. They will come pick it up "later." ${nm(who)} is famous.`; } g.kick(-8); return 'Zero bids. The floor price of the wall is the floor.'; } },
      { label: 'Hang a light on it', hint: '+vibes', effect: (g) => { g.kick(16); g.addRes('power', -5); return 'Lit up, the green candle makes everyone feel like it is the start of a bull run.'; } },
      { label: 'Ask for a red candle next', effect: (g, who) => { g.kick(-10); const n = g.addRes('copium', 15); return `${nm(who)} paints a red candle. Nobody can look at it. It is honest. +${n} copium.`; } },
    ],
  },
  {
    id: 'rektgroup',
    title: 'SUPPORT GROUP',
    body: (_g, who) => `${nm(who)} has started a support group in the Copium Den. "Hi, I'm ${nm(who)}, and I bought the top." Everyone: "Hi, ${nm(who)}."`,
    needs: (g) => has(g, 'rekt'),
    pickDweller: of('rekt'),
    options: [
      { label: 'Attend', hint: 'vibes to the middle', effect: (g) => { g.kick(-g.vibe * 0.6, -g.vibeVel * 0.5); const n = g.addRes('copium', 10); return `Everyone shares their worst trade. The bunker comes back to the middle. +${n} copium.`; } },
      { label: 'Share your story', hint: '-vibes, ++copium', effect: (g) => { g.kick(-10); const n = g.addRes('copium', 25); return `You tell them about the ramen you sold right before Ramen Deflation. People cry. +${n} copium.`; } },
      { label: 'Skip it', effect: (g) => { g.kick(-4); return 'You can hear them through the wall. "Has anyone here ever actually taken profit?" Silence.'; } },
    ],
  },
];
