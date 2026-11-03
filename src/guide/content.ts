// How to play BUNKR: one source for the in-game guide and the public guide page.
// Text supports the resource tokens (🍜 💧 ⚡ 💊 ☢), which render as the game's icons.
// Numbers marked with "testnet" are this build's settings and may change at launch.

export interface GuideCard {
  title: string;
  body: string;
  /** Optional art from public/art. */
  art?: string;
}

export interface GuideSection {
  id: string;
  tab: string;
  title: string;
  intro: string;
  cards: GuideCard[];
}

export const GUIDE: GuideSection[] = [
  {
    id: 'goal',
    tab: 'THE GOAL',
    title: 'Survive the apocalypse. Stay solvent.',
    intro: 'The news says nukes are coming. Your group chat says buy the dip. Both are right. You run a bunker under a porta-potty behind a burger joint, full of crypto degens. Keep them alive for 30 days.',
    cards: [
      { title: 'Win', body: 'Make it to day 30 with anyone still breathing, or find another way out. Your score is your Net Worth After Apocalypse: who survived, what you saved, what you beat.', art: 'hatch/smug.webp' },
      { title: 'Lose', body: 'Everyone gets liquidated. Starvation, thirst, radiation, raiders, and the occasional degen who goes outside to buy the dip.', art: 'hatch/dead.webp' },
      { title: 'Play again', body: 'Every run is different: new degens, new events, new disasters. Wins unlock harder DEFCON levels, and every run earns Ramen Futures for permanent upgrades.' },
    ],
  },
  {
    id: 'run',
    tab: 'A RUN',
    title: 'Prep, drop, survive.',
    intro: 'A full run takes about 20 minutes.',
    cards: [
      { title: '1. Prep', body: 'The bombs drop in 75 seconds. Build rooms, dig floors, and shill the group chat for more degens. Prices climb as the panic builds, so spend early.' },
      { title: '2. The Drop', body: 'Nukes hit. Anyone above ground is exit liquidity. HATCH says gm.', art: 'drop-end.webp' },
      { title: '3. Underground', body: 'Thirty days, about 36 seconds each. Keep everyone fed and sane, answer event cards, send degens on expeditions, and fight off the bosses.' },
      { title: 'The bosses', body: 'Day 10: the Liquidators raid. Day 20: the S.E.C. audits you. Day 28: the Mutant Whale, one giant sell wall with teeth.' },
      { title: 'Controls', body: 'Drag degens into rooms. Click a room to open it. W/S or the mouse wheel scrolls. Space pauses, 1x/2x/4x speeds things up, M mutes. Click the BUNKR logo to go home.' },
    ],
  },
  {
    id: 'survive',
    tab: 'SURVIVING',
    title: 'Five numbers and a mood.',
    intro: 'The tickers along the top are your bunker\'s portfolio.',
    cards: [
      { title: '🍜 Ramen', body: 'Food, and also money. You build with it, recruit with it, and eat it. Run out and degens start starving.' },
      { title: '💧 Water', body: 'Made in the Liquidity Pool. Run out and degens dehydrate. Fast.' },
      { title: '⚡ Power', body: 'Made in the Hopium Reactor. Every other room runs on it. No power, no output.' },
      { title: '💊 Copium', body: 'Brewed in the Copium Den. Spend it on COPE to calm the vibes.' },
      { title: '☢ Rads', body: 'Radiation only goes up. Above 50 it hurts everyone. Liquidity Pools scrub it down.' },
      { title: 'The vibe meter', body: 'It swings on its own between IT\'S SO OVER and WE\'RE SO BACK. Keep the needle in the middle for +20% output. Too far over and degens rage-quit. Too far back and they YOLO onto the surface. COPE and the grass room calm it down.' },
    ],
  },
  {
    id: 'bunker',
    tab: 'YOUR BUNKER',
    title: 'Dig, build, staff.',
    intro: 'Each room needs workers, and each one uses a different stat.',
    cards: [
      { title: 'Rooms', body: 'Reactor (power) and Kitchen (ramen) use GRIND. Liquidity Pool (water) and Meme Lab (Bags, one per bunker, each slower than the last) use BRAIN. Copium Den, Touch Grass Hydroponics and the Shill Tower (new degens) use VIBES. The Rug Detector (raid defense) uses HANDS. Cold Storage raises your ramen and water storage.', art: 'rooms/reactor.webp' },
      { title: 'Merge rooms', body: 'Build the same room next to itself to merge it, up to 3 wide, for bonus output. Every room you build makes the next one 8% pricier.' },
      { title: 'Room mods', body: 'Open a room to install its mod. Each one is strong and comes with a catch. The Leverage Coil triples power but can melt down. Instant Noodle Futures charge interest.' },
      { title: 'The radio', body: 'The Shill Tower picks the station. Hopium FM pushes the vibes up. Bear Market Blues pushes them down, but everyone grinds harder. Doomer Wave steadies the swings.', art: 'rooms/shill.webp' },
      { title: 'Storage', body: 'If a room costs more ramen than you can store, build Cold Storage first.' },
      { title: 'Late game', body: 'Some rooms only show up later. Survive long enough and you\'ll find out.' },
    ],
  },
  {
    id: 'degens',
    tab: 'YOUR DEGENS',
    title: 'Hire degens. Keep degens. Mostly.',
    intro: 'Click a degen to see their card.',
    cards: [
      { title: 'Archetypes', body: 'Eighteen kinds, from Laser-Eyes Maxi to Genesis Grandpa. Each has a perk and a curse. Paper Hands Pete works 50% harder and flees raids. Rarer ones show up less often.' },
      { title: 'Stats', body: 'GRIND, BRAIN, VIBES and HANDS decide how well they work in each room. Put your best grinder in the Kitchen.' },
      { title: 'Traits', body: 'Every degen also rolls one good trait and one cursed one: Diamond Hands, Galaxy Brain, Built Different, Bottomless Pit, Alpha Leaker, Chronic FOMO, and more.' },
      { title: 'Expeditions', body: 'Send a degen to the surface: a delisted exchange, a mining farm, a collapsed stablecoin peg, an influencer\'s mansion, Ground Zero, or a rival bunker. Better loot, worse odds. Sometimes they come back with a decision.' },
      { title: 'Press F', body: 'When a degen gets liquidated, mash F: 50 presses in 15 seconds brings them back. One chance per degen.' },
    ],
  },
  {
    id: 'events',
    tab: 'BOSSES & EVENTS',
    title: 'Things will happen to you.',
    intro: 'Most of them are your fault.',
    cards: [
      { title: 'Event cards', body: 'One to three times a day something shows up: a man from the future, a governance vote, a radioactive dog. Pick an option. Live with it. After any event you get a breather before the next one, and it gets longer later in the run.' },
      { title: 'Raids', body: 'The Liquidators and the Mutant Whale steal ramen and stab degens. Your crew fights automatically, and you can click the raiders to smash them yourself. Every 10th hit crits.', art: 'sprites/raider.webp' },
      { title: 'The audit', body: 'Day 20: approve the real paperwork, reject the fraud, before the timer runs out. Pass for a morale boost. Fail and they take ramen, and maybe a Bag.', art: 'sprites/secagent.webp' },
      { title: 'Bags', body: 'Relics with weird powers, found on expeditions, made in the Meme Lab, or dropped by raiders. Carry more than 5 and you\'re a Bagholder: output -10%.' },
      { title: 'This week', body: 'Every Monday (00:00 UTC) the wasteland changes, for every run including Daily Doom. Bear Market: everything costs double, score x1.3. Bull Run: rooms make 25% more and the vibes run hot, but rads +60%. Airdrop Season: crates fall most mornings, some hold Bags, some are live. Rug Season: extra raids on days 5 and 16, Rug Detectors work twice as hard. The Halving: rooms make 25% less, score x1.5. It shows on the title screen under THIS WEEK.' },
    ],
  },
  {
    id: 'score',
    tab: 'SCORE & UNLOCKS',
    title: 'Net Worth After Apocalypse.',
    intro: 'Your score at the end of a run.',
    cards: [
      { title: 'Scoring', body: 'Survivors are worth the most (250 each). Then the bosses you beat, the ramen, water, copium and Bags you held, the days you lasted and the raids you won. Harder settings multiply it.' },
      { title: 'Endings', body: 'Touched Grass. Bunker DAO. Whale Hunter. Liquidated. And others that need you to do something specific, or something terrible. Find them.' },
      { title: 'DEFCON', body: 'Survive DEFCON 5 to unlock DEFCON 4, and so on down to DEFCON 1. Each level is meaner and multiplies your score, up to x2.2.' },
      { title: 'Ramen Futures', body: 'Every run earns Ramen Futures: 1 per 1,000 score, +5 if you survived. Spend them in the Vault on permanent upgrades. Back up your progress with a save code in the Vault.' },
      { title: 'Daily Doom', body: 'One attempt a day, the same start for everyone, standard issue. Top 3 split the pot.' },
      { title: 'Share it', body: 'Every run ends with a PnL card. Post it.' },
    ],
  },
  {
    id: 'token',
    tab: '$BUNKR',
    title: '$BUNKR is the economy.',
    intro: '$BUNKR launches on Urufu Labs, on Robinhood Chain. Here is what it does in the game. Amounts are this build\'s testnet settings and may change at launch.',
    cards: [
      { title: 'Tent Mode (free)', body: 'No wallet? You can still play. Your tent lasts 3 days underground, then it collapses.', art: 'hatch/cry.webp' },
      { title: 'Bunker Deeds', body: 'Holding $BUNKR is your Deed. Your balance sets your tier: Shed 10K, Basement 100K, Bunker 1M, Silo 8M. Higher tiers get more Bag slots, the Rocket Room, a gold nameplate. Sell below a tier and that bunker is foreclosed. Want a harder run? Pick any Deed at or below yours in the Deed panel and play as that. You can never play above what you hold.' },
      { title: 'Ration Tickets', body: 'Every Deed gets 1 free run a day. More runs cost a ticket (2,500 $BUNKR): half is burned, half goes to the Daily Doom pot.' },
      { title: 'Daily Doom pot', body: 'Entry is 10,000 $BUNKR, one attempt a day: 80% goes straight into the pot, 20% is burned. When the day ends, the top 3 split it 50/30/20. The more players, the bigger the pot.' },
      { title: 'Forged Bags', body: 'Finish a run holding a Bag you found (Daily Doom counts) and you can forge it: burn $BUNKR and it becomes a token in your wallet (ERC-1155). Bring it into future runs, or trade it. Rarer Bags need higher Deeds. Every forged Bag is proof it was found: the results server verifies the run and signs for it, and the token records which run it came from.' },
      { title: 'They can break', body: 'Bags you carry are locked in the Forge for the run, so they can\'t be moved mid-run. Survive and they all come back. Get liquidated (or quit) and each has a 35% chance to shatter, gone for good. Daily Doom always uses standard issue.' },
      { title: 'Drip', body: 'Burn $BUNKR for cosmetics: Gold Bunker, Gamer Bunker, Good Boy Nuke (a dog-shaped mushroom cloud, in the drop and in the sky all run), Gold HATCH. Looks only. Also ERC-1155, also tradeable.', art: 'drip/dog.png' },
      { title: 'Price action is the weather', body: '$BUNKR price action determines the weather, checked live every few minutes; your run keeps the weather it started with. Up 8% or more in 24 hours: Bull Run Weather, with more loot, hotter vibes and more radiation. Down 8% or more: Nuclear Winter, with less loot and weaker raiders, score x1.2. In between: Crab Market, quiet. A swing of 8% within an hour hits everyone mid-run: WHALE SIGHTED on a pump, PAPER HANDS STORM on a dump.' },
      { title: 'Fair play', body: 'Every ticketed run is replayed on our results server before it counts, so the leaderboard and the pot only take real runs. Each day\'s randomness is revealed as you reach it, so nobody can simulate ahead.' },
      { title: 'Coming later', body: 'The Wasteland: every bunker on one map, one Doomsday Clock for everyone. Season 1.' },
    ],
  },
];

export const FAQ: { q: string; a: string }[] = [
  { q: 'Do I need to buy $BUNKR to play?', a: 'No. Tent Mode is free: no wallet, 3 days underground. Holding $BUNKR (a Bunker Deed) unlocks the full 30-day game, Daily Doom and the token features.' },
  { q: 'What happens to my forged Bag if I lose?', a: 'Only Bags you brought into that run are at risk. While the run is on they sit in the Forge, so they can\'t be sold or moved mid-run. Win and they all come back. Lose and each has a 35% chance to shatter (burned for good); the rest come back. If the game ever fails to settle a run, you can take them back yourself after a week. Daily Doom always uses standard issue, so nothing is at risk there.' },
  { q: 'Where does the Daily Doom pot come from?', a: 'Daily Doom entries (80% of each), the pot share of bought Ration Tickets, and top-ups like the creator fee from $BUNKR trading. It pays out to the top 3 when the UTC day ends.' },
  { q: 'Can someone cheat the leaderboard?', a: 'Scores are not taken from your browser. The results server replays every input of every ticketed run and only counts what it gets. Each day\'s randomness is only revealed when you reach it.' },
  { q: 'Is my progress saved?', a: 'Ramen Futures, DEFCON unlocks and Vault upgrades live in your browser. With a wallet connected, tap SAVE TO MY WALLET in the Vault (one free signature) and they follow you to any device, saved after every run. No wallet? Use the save code in the Vault to back them up or move them. Your Deed, tickets and forged items live on chain in your wallet. Closing the tab mid-run ends that run; a refresh does not.' },
  { q: 'What chain is this on?', a: 'Robinhood Chain. $BUNKR launches on Urufu Labs. The game contracts are testnet-only until they pass an outside audit.' },
];
