import type { CardDef } from './events';
import type { Dweller } from './types';
import type { Game } from './game';

// Second deck of event cards. Kept separate so each file stays readable.

const nm = (who: Dweller | null) => who?.name ?? 'Someone';
const has = (g: Game, arch: Dweller['arch']) => g.present.some((d) => d.arch === arch);
const of = (arch: Dweller['arch']) => (g: Game) => g.present.find((d) => d.arch === arch) ?? null;
const hasRoom = (g: Game, t: string) => g.rooms.some((r) => r.type === t);
const healAll = (g: Game, n: number) => g.present.forEach((d) => (d.hp = Math.min(100, d.hp + n)));

export const CARDS2: CardDef[] = [
  {
    id: 'fed',
    title: 'THE FED IS MEETING',
    body: () => 'The radio says the Fed is meeting. In its own bunker. To discuss rates. On what, nobody knows.',
    options: [
      { label: 'Pray for cuts', effect: (g) => { if (g.rng.chance(0.5)) { g.kick(25, 4); return 'CUTS. Nobody knows what got cut. Everyone is euphoric anyway.'; } g.kick(-15); return 'Rates unchanged. The bunker sighs in unison.'; } },
      { label: 'Short the Fed', hint: 'coin flip', effect: (g) => { if (g.rng.chance(0.5)) { const n = g.addRes('ramen', 40); return `You shorted the Fed. With ramen. It worked. +${n} 🍜`; } g.addRes('ramen', -40); return 'Never short the Fed. −40 🍜.'; } },
      { label: 'Ignore macro', effect: (g) => { const n = g.addRes('copium', 5); return `You don't do macro. You do vibes. +${n} 💊`; } },
    ],
  },
  {
    id: 'ponzi',
    title: 'RAMEN STAKING™',
    body: (_g, who) => `${nm(who)} is pitching "Ramen Staking": deposit 30 ramen today, get 45 ramen tomorrow. "Guaranteed."`,
    options: [
      { label: 'Deposit 30 ramen', effect: (g, who) => { g.addRes('ramen', -30); if (g.rng.chance(0.45)) { const n = g.addRes('ramen', 50); return `It paid out! +${n} 🍜. ${nm(who)} is now unbearable.`; } return `${nm(who)} "lost the keys to the staking contract." The ramen is gone.`; } },
      { label: 'Report it to HATCH', effect: (g) => { g.hatchMood = 'smug'; g.kick(-5); const n = g.addRes('copium', 10); return `HATCH: "Reported. Shame logged." +${n} 💊`; } },
      { label: 'Become a co-founder', hint: '+recruiting', effect: (g) => { g.recruitProg += 40; g.kick(10); return 'You are now a co-founder of Ramen Staking™. Recruiting +40. Regulators are on the surface. Probably dead.'; } },
    ],
  },
  {
    id: 'proposal',
    title: 'PROPOSAL #69',
    body: () => 'The bunker DAO is voting to rename the bunker. Turnout: 100%. Nobody has anything else to do.',
    options: [
      { label: 'Vote "BUNKR"', effect: (g) => { g.kick(8); return 'BUNKR wins. Tradition. Brand consistency. Boring. Correct.'; } },
      { label: 'Vote "Bunker McBunkerface"', effect: (g) => { g.kick(15); g.addRes('power', -5); return 'It wins in a landslide. Repainting the sign cost 5 power. Worth it.'; } },
      { label: 'Abstain', effect: () => 'You abstained. A degen calls you a "fence-sitter" and then sits on a fence.' },
    ],
  },
  {
    id: 'course',
    title: 'A VOICE ON THE RADIO SELLS A COURSE',
    body: () => '"Learn to trade the apocalypse! Only 60 ramen! Spots are limited!" There is one spot. It is the apocalypse.',
    options: [
      { label: 'Buy the course', hint: '-60 ramen', effect: (g) => { g.addRes('ramen', -60); g.present.forEach((d) => (d.brain = Math.min(10, d.brain + 1))); return 'It was one slide: "buy low." Somehow, everyone is smarter. +1 Brain to all.'; } },
      { label: 'Haggle', effect: (g, who) => { g.addRes('ramen', -20); if (who) who.brain = Math.min(10, who.brain + 1); return `You got the PDF for 20 ramen. ${nm(who)} read it. +1 Brain.`; } },
      { label: 'Hang up', effect: () => 'The voice calls back four times. Then it gets the hint.' },
    ],
  },
  {
    id: 'mirror',
    title: 'SOMEONE FOUND A MIRROR',
    body: (g, who) => `It's day ${g.day} underground. ${nm(who)} looks in a mirror for the first time since the bombs. It's a lot.`,
    options: [
      { label: 'Do a skincare routine', hint: '-5 water', effect: (g) => { g.addRes('water', -5); g.kick(10); return 'Hydrated. Moisturized. Unbothered. In a bunker.'; } },
      { label: 'Smash it', effect: (g) => { g.kick(-15); return 'Seven years of bad luck. The apocalypse already used up most of it.'; } },
      { label: 'Hang it in the Copium Den', effect: (g) => { const n = g.addRes('copium', 5); return `"You look great," says everyone, to everyone. +${n} 💊`; } },
    ],
  },
  {
    id: 'rats',
    title: 'MUTANT RATS IN THE VENTS',
    body: () => 'They are the size of dogs. They want ramen. They have opinions.',
    options: [
      { label: 'Feed them', hint: '-20 ramen', effect: (g) => { g.addRes('ramen', -20); g.kick(15); return 'They are friends now. One is named Gerald.'; } },
      { label: 'Fight them', effect: (g, who) => { if (who) g.hurt(who, 25, 'mutant rat bites'); const n = g.addRes('ramen', 30); return `${nm(who)} won, barely. −25 HP. Rat ramen is ramen. +${n} 🍜`; } },
      { label: 'Unionize them', hint: '+recruiting', effect: (g) => { g.recruitProg += 30; return 'The rats unionized. They are now recruiting for you. Recruiting +30.'; } },
    ],
  },
  {
    id: 'leverage',
    title: '100× LEVERAGE ON CANNED BEANS',
    body: (_g, who) => `${nm(who)} wants to borrow 40 ramen to open a 100× long on canned beans. "Beans only go up."`,
    options: [
      { label: 'Lend it', hint: '40% big win', effect: (g, who) => { g.addRes('ramen', -40); if (g.rng.chance(0.4)) { const n = g.addRes('ramen', 120); return `Beans mooned. ${nm(who)} pays you back with interest. +${n} 🍜`; } g.kick(-10); return `Beans dipped 1%. ${nm(who)} got liquidated. Emotionally.`; } },
      { label: 'No', effect: (g) => { g.kick(-5); return '"You\'ll regret this when beans hit $10k." You will not.'; } },
    ],
  },
  {
    id: 'drone',
    title: 'A DRONE DROPS A PACKAGE',
    body: () => 'A drone drops a package on the porta-potty and flies away. No return address. It\'s ticking. Or purring.',
    options: [
      { label: 'Open it', hint: 'mystery', effect: (g, who) => { const r = g.rng.next(); if (r < 0.4) { const b = g.giveBag(); return b ? 'It was a Bag! Free bags. Never a bad thing. Usually.' : 'It was empty. The drone was the gift.'; } if (r < 0.7) { const n = g.addRes('power', 60); return `It's a battery the size of a fridge. +${n} ⚡`; } if (who) g.hurt(who, 30, 'a mystery package'); return `It was a glitter bomb. Radioactive glitter. ${nm(who)} −30 HP.`; } },
      { label: 'Return to sender', effect: (g) => { g.kick(5); return 'You wrote "RETURN TO SENDER" on it. Nobody can return it. Still, principles.'; } },
      { label: 'Sell it unopened', effect: (g) => { const n = g.addRes('ramen', 50); return `Sold as a "mystery box." +${n} 🍜. You will never know.`; } },
    ],
  },
  {
    id: 'karaoke',
    title: 'BUNKER KARAOKE NIGHT',
    body: (_g, who) => `${nm(who)} grabbed the mic. The song choice is a 14-minute ballad about a token that went to zero.`,
    options: [
      { label: 'Join in', hint: '-5 power', effect: (g) => { g.addRes('power', -5); g.kick(20); return 'The whole bunker sings the bridge. Someone cries. It\'s beautiful.'; } },
      { label: 'Unplug the speakers', effect: (g) => { g.kick(-10); return 'Silence. Then a cappella. It\'s worse.'; } },
      { label: 'Charge admission', effect: (g) => { const n = g.addRes('ramen', 25); g.kick(-5); return `Tickets: 2 ramen each. +${n} 🍜. Capitalism survives everything.`; } },
    ],
  },
  {
    id: 'birthday',
    title: 'IT\'S SOMEONE\'S BIRTHDAY',
    body: (_g, who) => `${nm(who)} turns another year older underground. There is no cake. There is ramen.`,
    options: [
      { label: 'Throw a party', hint: '-25 ramen', effect: (g, who) => { g.addRes('ramen', -25); g.kick(25); healAll(g, 10); return `A ramen cake with a single candle. ${nm(who)} wishes for a green candle. Everyone +10 HP.`; } },
      { label: 'Make a card', effect: (g) => { g.kick(5); return 'The card says "hbd ser". Heartfelt.'; } },
      { label: 'Forget', effect: (g, who) => { g.kick(-12); if (who) who.vibes = Math.max(1, who.vibes - 1); return `Everyone forgot. ${nm(who)} noticed. −1 Vibes.`; } },
    ],
  },
  {
    id: 'hum',
    title: 'THE REACTOR STOPPED HUMMING',
    body: () => 'Total silence. It\'s the scariest thing anyone has heard in weeks.',
    needs: (g) => hasRoom(g, 'reactor'),
    options: [
      { label: 'Hum for it', effect: (g) => { const n = g.addRes('power', 10); g.kick(5); return `The whole bunker hums. Awkwardly. The reactor joins in. +${n} ⚡`; } },
      { label: 'Hit the reset button', effect: (g) => { g.addRes('power', -20); g.addRads(-5); return 'It reboots. It lost 20 power and 5 rads. Fair trade.'; } },
      { label: 'Panic', effect: (g) => { g.kick(0, -16); return 'You panicked. Now everyone is panicking. The reactor started humming again halfway through.'; } },
    ],
  },
  {
    id: 'alphacalls',
    title: 'A TELEGRAM GROUP INVITE',
    body: () => 'You\'ve been added to "BUNKER ALPHA CALLS (VIP)". 4,000 members. 3,999 are bots.',
    options: [
      { label: 'Follow the next call', hint: 'coin flip', effect: (g) => { if (g.rng.chance(0.5)) { const n = g.addRes('ramen', 45); return `One call actually hit. +${n} 🍜. You'll be chasing that high forever.`; } g.addRes('ramen', -25); return 'The call was "buy the top." You did. −25 🍜.'; } },
      { label: 'Mute it', effect: (g) => { const n = g.addRes('copium', 3); return `Muted. Inner peace. +${n} 💊`; } },
      { label: 'Start a rival group', hint: '+recruiting', effect: (g) => { g.recruitProg += 45; return '"BUNKER ALPHA CALLS 2 (REAL)". Recruiting +45.'; } },
    ],
  },
  {
    id: 'ufo',
    title: 'A UFO LANDED ON THE SURFACE',
    body: () => 'Aliens. Actual aliens. They\'re asking to speak to whoever is in charge of "this planet\'s token."',
    once: true,
    options: [
      { label: 'Wave', effect: (g) => { g.kick(10); return 'They wave back with six arms. Bullish for interstellar relations.'; } },
      { label: 'Ask them for a loan', effect: (g) => { if (g.rng.chance(0.6)) { const n = g.addRes('ramen', 80); return `They accept JPEG collateral. +${n} 🍜. Interest rate: one soul.`; } g.kick(-10); return 'They laughed in a frequency that cracked a monitor.'; } },
      { label: 'Sell them the bunker', hint: 'risky', effect: (g) => { const n = g.addRes('ramen', 200); g.kick(-30); g.addRads(10); return `They paid ${n} ramen and left nuclear exhaust everywhere. You still live here. They "own" it.`; } },
    ],
  },
  {
    id: 'pipe',
    title: 'A PIPE BURST',
    body: () => 'A pipe burst in the Liquidity Pool. Water is spraying everywhere. The flamingo is thriving.',
    needs: (g) => hasRoom(g, 'pool'),
    options: [
      { label: 'Have someone fix it', effect: (g, who) => { if (who && who.brain >= 5) { const n = g.addRes('water', 20); return `${nm(who)} fixed it with duct tape and confidence. +${n} 💧`; } g.addRes('water', -30); return `${nm(who)} made it worse. −30 💧. The flamingo is now airborne.`; } },
      { label: 'Drink from it', effect: (g) => { const n = g.addRes('water', 15); g.addRads(8); return `Free water! +${n} 💧. Free rads too. +8 ☢`; } },
      { label: 'Call a plumber', effect: (g) => { g.kick(-10); return 'There are no plumbers. There are no phones. You are holding a can.'; } },
    ],
  },
  {
    id: 'chainletter',
    title: 'A CHAIN LETTER IN THE VENTS',
    body: () => '"Forward this to 5 degens or your bags will go to zero." It is handwritten. It is in your handwriting.',
    options: [
      { label: 'Forward it', hint: '-3 copium', effect: (g) => { g.addRes('copium', -3); g.kick(12); return 'Forwarded. Five degens now fear their bags. Morale strangely up.'; } },
      { label: 'Break the chain', effect: (g) => { if (g.rng.chance(0.5)) return 'Nothing happened. Science wins.'; g.kick(-20); return 'Nothing happened. But everyone SAW you break it. Morale −20.'; } },
      { label: 'Frame it', effect: (g) => { const n = g.addRes('copium', 5); return `It's art now. +${n} 💊`; } },
    ],
  },
  {
    id: 'gym',
    title: 'SOMEONE BUILT A GYM',
    body: (_g, who) => `${nm(who)} built a gym out of ramen crates and a broken treadmill. It is called "Bunker Gains."`,
    options: [
      { label: 'Lift', effect: (_g, who) => { if (who) who.grind = Math.min(10, who.grind + 2); return `${nm(who)} lifted a crate of ramen 40 times. +2 Grind.`; } },
      { label: 'Spectate', effect: (g) => { g.kick(5); return 'You watched. You sweated anyway. Solidarity.'; } },
      { label: 'Wire the treadmill to the grid', effect: (g) => { const n = g.addRes('power', 30); return `Cardio is now a power source. +${n} ⚡`; } },
    ],
  },
  {
    id: 'collab',
    title: 'COLLAB REQUEST',
    body: () => 'Another bunker slid into your DMs: "big fan. collab? we can cross-promote our bunkers."',
    options: [
      { label: 'Accept', hint: '-10 ramen, +recruiting', effect: (g) => { g.addRes('ramen', -10); g.recruitProg += 50; return 'Collab live. Recruiting +50. Your bunker is "in talks."'; } },
      { label: 'Ask for payment upfront', effect: (g) => { const n = g.addRes('ramen', 30); return `They paid ${n} ramen upfront. You will deliver nothing. Like a real collab.`; } },
      { label: 'Ghost them', effect: (g) => { const n = g.addRes('copium', 2); return `Seen 3h ago. +${n} 💊`; } },
    ],
  },
  {
    id: 'mintbunker',
    title: 'THE NFT ARTIST WANTS TO MINT THE BUNKER',
    body: (_g, who) => `${nm(who)} wants to mint the bunker as a 1/1. "Generative. Post-apocalyptic. Very now."`,
    needs: (g) => has(g, 'nftartist'),
    pickDweller: of('nftartist'),
    options: [
      { label: 'Let them mint', hint: 'coin flip', effect: (g) => { if (g.rng.chance(0.5)) { const n = g.addRes('ramen', 80); return `It sold. To who? Nobody knows. +${n} 🍜`; } g.kick(-20); return 'Floor price: zero. The bunker is now worth less as a JPEG than as a bunker.'; } },
      { label: 'Commission a portrait', hint: '-15 ramen', effect: (g) => { g.addRes('ramen', -15); g.kick(18); return 'A group portrait of the whole bunker. Everyone looks heroic. Nobody looks like that.'; } },
      { label: 'No', effect: () => '"You don\'t understand art." Correct.' },
    ],
  },
  {
    id: 'mevlunch',
    title: 'SOMEONE ATE EVERYONE\'S LUNCH',
    body: (_g, who) => `Every lunch in the bunker vanished 0.2 seconds before anyone reached for it. ${nm(who)}'s eye is glowing.`,
    needs: (g) => has(g, 'mevbot'),
    pickDweller: of('mevbot'),
    options: [
      { label: 'Unplug the bot', effect: (g, who) => { if (who) g.hurt(who, 30, 'being unplugged'); g.kick(10); return `${nm(who)} reboots with a sad beep. −30 HP. Lunch is safe for now.`; } },
      { label: 'Lock the fridge', hint: '-15 power', effect: (g) => { g.addRes('power', -15); return 'The fridge now runs a private mempool. The bot is furious.'; } },
      { label: 'Let it eat', hint: '-25 ramen', effect: (g) => { g.addRes('ramen', -25); return 'It ate 25 ramen in one block. Impressive. Infuriating.'; } },
    ],
  },
  {
    id: 'vcadvise',
    title: 'THE VC WANTS TO "ADVISE"',
    body: (_g, who) => `${nm(who)} offers to "add value" to the bunker in exchange for 20% of the ramen supply.`,
    needs: (g) => has(g, 'vc'),
    pickDweller: of('vc'),
    options: [
      { label: 'Accept 20% dilution', effect: (g) => { const n = Math.round(g.res.ramen * 0.2); g.res.ramen -= n; g.researchProg += 40; g.recruitProg += 30; return `−${n} 🍜. In return: "intros." Research +40, Recruiting +30. Somehow it worked.`; } },
      { label: 'Counter at 2%', effect: (g, who) => { g.kick(10); return `${nm(who)} laughs, then accepts, then tells everyone it was their idea.`; } },
      { label: 'Show them the porta-potty', effect: (g) => { g.kick(-5); return 'They leave. They come back 10 minutes later. Nowhere else to go.'; } },
    ],
  },
  {
    id: 'pizzastory',
    title: 'GRANDPA TELLS THE PIZZA STORY',
    body: (_g, who) => `${nm(who)} is telling the story about buying two pizzas with 10,000 coins. Again. Everyone knows how it ends.`,
    needs: (g) => has(g, 'grandpa'),
    pickDweller: of('grandpa'),
    options: [
      { label: 'Listen respectfully', effect: (g) => { g.kick(15); healAll(g, 10); return 'Somehow it\'s comforting every time. Everyone +10 HP.'; } },
      { label: 'Fall asleep', effect: (g) => { const n = g.addRes('copium', 5); return `Best nap in weeks. +${n} 💊`; } },
      { label: 'Ask about the old wallet', hint: 'long shot', effect: (g, who) => { if (g.rng.chance(0.35)) { const n = g.addRes('ramen', 250); return `${nm(who)} remembers three words of an old seed phrase. It was enough. +${n} 🍜`; } g.kick(-5); return `${nm(who)} remembers it was "on a floppy disk somewhere." Nobody has seen a floppy since 1998.`; } },
    ],
  },
  {
    id: 'carlhackers',
    title: 'CARL DETECTS HACKERS',
    body: (_g, who) => `${nm(who)} is convinced hackers are in the ventilation. "They're after the hardware wallets."`,
    needs: (g) => has(g, 'coldcarl'),
    pickDweller: of('coldcarl'),
    options: [
      { label: 'Unplug everything', hint: '-30 power', effect: (g) => { g.addRes('power', -30); g.kick(10); return 'Air-gapped. Safe. Dark. Very dark.'; } },
      { label: 'Trust Carl', hint: 'weaker next raid', effect: (g) => { g.raidMod = Math.min(g.raidMod, 0.8); return 'Carl booby-trapped every vent. The next raid will be 20% weaker. Do not touch the vents.'; } },
      { label: 'There are no hackers', effect: (g, who) => { g.kick(-15); return `"That's exactly what a hacker would say." ${nm(who)} stops talking to you.`; } },
    ],
  },
  {
    id: 'rektplan',
    title: 'A COMEBACK PLAN',
    body: (_g, who) => `${nm(who)} has a comeback plan. It is written on a napkin. It is mostly tears.`,
    needs: (g) => has(g, 'rekt'),
    pickDweller: of('rekt'),
    options: [
      { label: 'Believe in them', hint: 'coin flip', effect: (g, who) => { if (g.rng.chance(0.5)) { const n = g.addRes('ramen', 60); g.kick(20); return `The plan worked. ${nm(who)} is still crying, but happy crying. +${n} 🍜`; } g.addRes('ramen', -20); return `The plan did not work. ${nm(who)} has a new plan. −20 🍜.`; } },
      { label: 'Give a hug', effect: (g) => { g.kick(10); return 'The hug lasts four minutes. It was needed.'; } },
      { label: 'Ask them to stop crying', effect: (g) => { g.kick(-5); return 'They cry harder. Of course they do.'; } },
    ],
  },
  {
    id: 'pumpsignal',
    title: 'PUMP GROUP SIGNAL',
    body: () => '"BUY $GLOWSHROOM AT THE OPEN. WE MOON TOGETHER." Sent by: unknown.',
    options: [
      { label: 'Buy at the open', hint: '25% huge', effect: (g) => { if (g.rng.chance(0.25)) { const n = g.addRes('ramen', 150); return `IT MOONED. +${n} 🍜. You will tell this story for years.`; } g.addRes('ramen', -50); return 'You were the exit liquidity. −50 🍜. Larry would be proud.'; } },
      { label: 'Resell the signal', effect: (g) => { const n = g.addRes('ramen', 30); g.kick(-10); return `You sold the signal to three other bunkers. +${n} 🍜. Karma: pending.`; } },
      { label: 'Report the group', effect: (g) => { const n = g.addRes('copium', 8); return `Reported. To whom? Doesn't matter. Feels good. +${n} 💊`; } },
    ],
  },
  {
    id: 'reactorbaby',
    title: 'THE REACTOR MADE A NOISE LIKE A BABY',
    body: () => 'A soft, gurgling coo from the reactor core. Everyone heard it. Nobody wants to talk about it.',
    needs: (g) => hasRoom(g, 'reactor'),
    options: [
      { label: 'Name it', effect: (g) => { g.kick(12); return 'It\'s named "Little Hopium." It coos at feeding time.'; } },
      { label: 'Feed it', hint: '-10 ramen', effect: (g) => { g.addRes('ramen', -10); const n = g.addRes('power', 25); return `It ate ramen. Somehow. +${n} ⚡`; } },
      { label: 'Don\'t think about it', effect: (g) => { g.addRads(4); return 'You stopped thinking about it. It did not stop cooing. +4 ☢'; } },
    ],
  },
  {
    id: 'blackout',
    title: 'ROLLING BLACKOUT',
    body: () => 'The lights flicker, then die. Somewhere, a degen screams "WHO TOUCHED THE BREAKER."',
    options: [
      { label: 'Ride it out', hint: '-35 power', effect: (g) => { g.addRes('power', -35); return 'Four hours of darkness. Someone ate a crayon. −35 ⚡'; } },
      { label: 'Hand-crank generator', effect: (g, who) => { if (who) g.hurt(who, 10, 'hand-cranking a generator'); const n = g.addRes('power', 20); return `${nm(who)} cranked for an hour. −10 HP, +${n} ⚡`; } },
      { label: 'Light candles', effect: (g) => { g.kick(10); return 'Candlelight. Cozy. Romantic, even. Then someone mentions the chart.'; } },
    ],
  },
  {
    id: 'cat',
    title: 'A RADIOACTIVE CAT WANDERS IN',
    body: () => 'It glows softly. It has two tails. It sits on the warmest mining rig and refuses to move.',
    once: true,
    options: [
      { label: 'Adopt it', effect: (g) => { g.kick(20); g.addRads(5); return 'It\'s the bunker\'s cat now. +20 vibes. +5 rads. Worth it.'; } },
      { label: 'Shoo it', effect: (g) => { g.kick(-5); return 'It leaves. It looks back once. You think about it a lot.'; } },
      { label: 'Make it HATCH\'s assistant', effect: (g) => { g.hatchMood = 'laugh'; const n = g.addRes('copium', 10); return `HATCH: "Finally. A competent colleague." +${n} 💊`; } },
    ],
  },
  {
    id: 'bookclub',
    title: 'BUNKER BOOK CLUB',
    body: () => 'There is exactly one book in the bunker. It is a 400-page whitepaper.',
    options: [
      { label: 'Read it aloud', effect: (g) => { g.researchProg += 20; g.kick(-5); return 'It\'s 400 pages of the word "soon." Research +20. Spirits −5.'; } },
      { label: 'Burn it for warmth', effect: (g) => { const n = g.addRes('power', 10); g.kick(5); return `Most useful it\'s ever been. +${n} ⚡`; } },
      { label: 'Skip to the end', effect: (g) => { g.kick(3); return 'The last page just says "wagmi." Satisfying.'; } },
    ],
  },
  {
    id: 'timecapsule',
    title: 'A TIME CAPSULE FROM THE BULL RUN',
    body: () => 'A sealed box labeled "DO NOT OPEN UNTIL WE\'RE RICH." It is from your previous life.',
    once: true,
    options: [
      { label: 'Open it', effect: (g) => { if (g.rng.chance(0.5)) { const b = g.giveBag(); if (b) return 'Inside: a Bag, and a note: "you\'re welcome, future me."'; } g.kick(-15); return 'Inside: a printed screenshot of your all-time-high portfolio. Everyone cries.'; } },
      { label: 'Rebury it', effect: (g) => { g.kick(5); return 'Some things are better left buried. Like your trade history.'; } },
      { label: 'Sell it as vintage', effect: (g) => { const n = g.addRes('ramen', 40); return `Vintage bull-run memorabilia. +${n} 🍜`; } },
    ],
  },
  {
    id: 'otherbunker',
    title: 'A SIGNAL FROM ANOTHER BUNKER',
    body: () => 'A crackly radio voice: "Bunker 7 here. We have water and no ramen. Or ramen and no water. Honestly it\'s chaos."',
    options: [
      { label: 'Trade ramen for water', hint: '30 🍜 → 40 💧', effect: (g) => { g.addRes('ramen', -30); const n = g.addRes('water', 40); return `Deal. +${n} 💧. They sound grateful and slightly unwell.`; } },
      { label: 'Trade water for ramen', hint: '30 💧 → 40 🍜', effect: (g) => { g.addRes('water', -30); const n = g.addRes('ramen', 40); return `Deal. +${n} 🍜. They are now very hydrated and very sad.`; } },
      { label: 'Send memes', effect: (g) => { g.kick(12); return 'You sent memes over shortwave radio. They sent memes back. Diplomacy.'; } },
    ],
  },
];
