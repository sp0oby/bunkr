# BUNKR game contracts

Foundry project for the $BUNKR token layer. The real $BUNKR is a standard ERC-20 launched on Urufu Labs (no admin keys), so every game sink lives here.

| Contract | What it does |
|---|---|
| `MockBUNKR` | Testnet stand-in: 800M fixed supply, Permit, a 120K/day faucet. Never deploy to mainnet. |
| `BunkrTickets` | Deed tier from balance (Shed 10K, Basement 100K, Bunker 1M, Silo 8M). One free run ticket per Deed per UTC day. Bought tickets cost 2,500: 50% burned to `0x…dEaD`, 50% to the day's Daily Doom pot. Daily Doom has its own entry fee (10,000: 80% to the pot, 20% burned), one attempt per player per day, so the pot grows with every player. `fundPot(day, amount)` lets anyone top up a day's pot: route the 1% Urufu creator fee here. The oracle settles or rolls pots. Prices are in tokens; retune with `setConfig` / `setDaily` as the coin's price moves. |
| `BunkrForge` | ERC-1155 forged Bags (ids 0-19) and cosmetics (ids 100-103: Gold Bunker, Gamer Bunker, Good Boy Nuke, Gold HATCH; looks only). Forging burns $BUNKR; rare needs Basement, legendary needs Bunker. Only the oracle can shatter a Bag, once per run. |

Token ids follow `FORGE_ORDER` in `src/chain/config.ts`; rarities are in `script/Deploy.s.sol`.

## Commands (from the repo root)

```bash
npm run contracts:setup   # first time: installs forge-std + OpenZeppelin into contracts/lib
npm run contracts:test
npm run chain             # local Anvil chain on :8545
npm run deploy:local      # deploys and writes src/chain/deployments/31337.json
```

In `npm run dev`, the game uses the local chain when `31337.json` exists, and offers a "USE TEST WALLET" button (Anvil account #1).

## Robinhood Chain testnet (46630)

Fund a deployer with testnet ETH, then:

```bash
npm run deploy:testnet    # prompts for the deployer key; writes src/chain/deployments/46630.json
```

Set `BUNKR_TOKEN=<address>` to use an existing token instead of deploying MockBUNKR, and `ORACLE=<address>` for the results signer (defaults to the deployer). Build with `VITE_BUNKR_CHAIN=46630` to force the testnet.

## Results server (`server/`)

The oracle. Every ticketed run is checked by replaying it:

1. `enterRun(daily, keccak256(secret))` spends a ticket. Only the player's browser knows `secret`.
2. `POST /run/start` with the ticket's tx hash and the secret. The server reads the `RunEntered` event, then hands out the seed (secret-derived; Daily Doom uses the shared daily seed) and the official run config, with the forged loadout checked against on-chain balances and tier.
3. The game records every player action with its sim tick. Each underground day's randomness comes from `POST /run/day`, which only hands out day N+1 after day N, and no faster than 5 seconds apart (a human at 4x speed). Nobody can simulate ahead: the seed for tomorrow doesn't exist on their machine yet. Daily Doom shares the prep phase (same seed for everyone) but deals the underground days per run, so one leaked attempt can't be practiced by everyone else.
4. `POST /run/finish` with the inputs. The server replays the run from the seed and stores *its* result, never the browser's score.
5. Liquidated with forged Bags: each has a 35% chance to shatter (`BunkrForge.shatter`). Runs with a loadout that never report back count as liquidated after 3 hours.
6. Once a UTC day ends, its pot goes to the top 3 Daily Doom scores (50/30/20; 60/40 for two players) or rolls into today's pot.

```bash
npm run server        # local: uses Anvil + the deployer as the oracle
npm run server:test   # replay determinism
npx tsx server/test/e2e.ts   # full flow against Anvil + a running server
```

For testnet, set `CHAIN_ID=46630`, `ORACLE_KEY` (the address passed as `ORACLE` at deploy) and `SERVER_SECRET`, and build the game with `VITE_BUNKR_SERVER=<server url>`.

Still to do: host it, a real database, and an outside audit before mainnet.
