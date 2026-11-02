# BUNKR game contracts

Foundry project for the $BUNKR token layer. The real $BUNKR is a standard ERC-20 launched on Urufu Labs (no admin keys), so every game sink lives here.

| Contract | What it does |
|---|---|
| `MockBUNKR` | Testnet stand-in: 800M fixed supply, Permit, a 120K/day faucet. Never deploy to mainnet. |
| `BunkrTickets` | Deed tier from balance (Shed 10K, Basement 100K, Bunker 1M, Silo 8M). One free run ticket per Deed per UTC day. Bought tickets cost 2,500: 50% burned to `0x…dEaD`, 50% to the day's Daily Doom pot. The oracle settles or rolls pots. |
| `BunkrForge` | ERC-1155 forged Bags. Forging burns $BUNKR; rare needs Basement, legendary needs Bunker. Only the oracle can shatter a Bag, once per run. |

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

Not done yet: the results server (signs outcomes, settles Daily Doom pots, rolls Bag shatters) and an outside audit before mainnet.
