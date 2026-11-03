# BUNKR — Must-Do List

Things that have to happen before launch. Not optional.

## 1. $BUNKR token layer (Robinhood Chain testnet first) — IN PROGRESS
- [x] Contracts: MockBUNKR, BunkrTickets (Deeds, Ration Tickets, Daily Doom pot), BunkrForge (forged Bags) + tests
- [x] Wallet connect, Deed panel, ticket per run, Tent Mode, forged-Bag loadout, forge from the end screen
- [ ] Deploy to Robinhood Chain testnet (needs a funded deployer key: `npm run deploy:testnet`, with `META_BASE=<site>/meta/` and `SITE_URL=<site> npm run meta` first)
- [x] ERC-1155 metadata: name/symbol, per-item JSON (name, image, traits), collection contractURI
- [x] Results server: verifies every ticketed run by replaying its inputs, settles Daily Doom pots, rolls Bag shatters, Daily leaderboard
- [x] No simulating ahead: each underground day's seed comes from the server, in order, at human pace
- [ ] Host the results server (needs ORACLE_KEY + SERVER_SECRET) and a real database before mainnet traffic
- [x] Daily Doom panel: pot, prizes, top 10 with your rank, yesterday's payout; board on the Daily end screen
- [x] Daily Doom pot scales with players: 10K entry, 80% to the pot; anyone can top it up (`fundPot`)
- [ ] At launch: set the Daily entry fee from the coin's price (`setDaily`), and send creator fees into the pot
- [x] Chart-as-weather + WHALE SIGHTED / PAPER HANDS STORM events (reads DEX Screener once $BUNKR trades: set WEATHER_TOKEN on the server)
- [x] Burn-to-drip cosmetics: Gold Bunker, Gamer Bunker, Good Boy Nuke, Gold HATCH
- [ ] The Wasteland season mode — LATER update; only a teaser on the title screen for now
- [ ] Outside audit before mainnet

## 2. Real mobile version
Today the title screen works on phones, but in-game is broken. Phones currently get a "play it on PC" screen instead.
- [ ] Top bar resource pills stack down the middle and cover the bunker → compact, icon-only HUD
- [ ] Fitting all 6 room columns on a narrow screen makes rooms tiny → play in **landscape**, with a "rotate your phone" screen in portrait
- [ ] Pinch-zoom and swipe-pan on touch screens only (desktop keeps the fixed camera)
- [ ] Things that rely on mouse hover (gag labels in rooms) need tap equivalents
- [ ] Tap-to-assign tuned for fingers (bigger hit areas, no tiny targets)
- [ ] Remove the "play on PC" gate once this ships

Slot: after the token layer, before the tutorial — most crypto players will open the link on their phones.

## 3. First-run tutorial
- HATCH walks a new player through: build a reactor, drag a degen in, keep the vibes in the middle, survive day 1

## Done recently
- Minigames: F-to-revive (50 Fs in 15s), raid smashing, expedition return choices
- Degen traits, room mods, Shill Tower radio stations, Missile Silo, weekly mutators
- Endings: Exit Liquidity, Rugged Your Own Bunker, Became the Raiders
- 82 event cards, trading-terminal HUD (candles, order receipts, CRT), surface expeditions
- Shareable PnL card, save codes (Vault > Backup)
- 36-second in-game days (was 24s; a minute felt stagnant); boss fights stay full speed
- Phones get HATCH's "this bunker is PC-only" screen (with an "i like pain" override)
