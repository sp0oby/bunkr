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

## 2. Phones — DECIDED: PC and tablet only for now (2026-11-17)
A phone layout was built (upright and sideways) and pulled: the game's busy PC screen squeezed onto a phone
felt congested. A good phone version needs its own simpler design; revisit after launch.
- [x] Phones get HATCH's "bigger screen" card (guide link, copy link, "let me in anyway"); tablets (short side 600px+) play
- [x] Touch controls kept for tablets: drag a degen into a room, tap degen then room, swipe to scroll, pinch to zoom, edge-scroll while carrying
- [ ] Try it on a real iPad / Android tablet

## 3. First-run tutorial — DONE
- [x] HATCH walks a new player through: build a reactor, drag a degen in, kitchen, pool, tickers, vibes, the drop, survive day 1 (prep clock frozen while learning; auto on first run, replay from How to Play, skippable)

## Done recently
- How to Play: in-game guide (title screen) + public guide page at /guide.html, one source (src/guide/content.ts)
- Minigames: F-to-revive (50 Fs in 15s), raid smashing, expedition return choices
- Degen traits, room mods, Shill Tower radio stations, Missile Silo, weekly mutators
- Endings: Exit Liquidity, Rugged Your Own Bunker, Became the Raiders
- 82 event cards, trading-terminal HUD (candles, order receipts, CRT), surface expeditions
- Shareable PnL card, save codes (Vault > Backup)
- 36-second in-game days (was 24s; a minute felt stagnant); boss fights stay full speed
- Achievements: 20, verified by the results server's replay
