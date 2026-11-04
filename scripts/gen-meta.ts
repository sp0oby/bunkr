// Writes ERC-1155 metadata for BunkrForge into public/meta/, served by the game site.
// Item `id` lives at <SITE_URL>/meta/<id>.json; the collection at <SITE_URL>/meta/contract.json.
//
//   SITE_URL=https://bunkr.game npx tsx scripts/gen-meta.ts
//
// `npm run build` runs this first, so a Vercel build writes its own domain in. Deploy the
// contracts with META_BASE=<SITE_URL>/meta/ (or call setMetadata on an existing Forge).
import { mkdirSync, writeFileSync } from 'node:fs';
import { BAGS } from '../src/sim/content';
import { COSMETICS, FORGE_ORDER, TIERS } from '../src/chain/constants';

const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const SITE = (process.env.SITE_URL ?? (vercel ? `https://${vercel}` : 'http://localhost:5173')).replace(/\/+$/, '');
const OUT = 'public/meta';
mkdirSync(OUT, { recursive: true });

// Must match the forge recipes in contracts/script/Deploy.s.sol.
const BAG_TIER = { common: 1, rare: 2, legendary: 3 } as const;
const BAG_COST = { common: 5_000, rare: 25_000, legendary: 100_000 } as const;
const DRIP_COST: Record<number, number> = { 100: 50_000, 101: 50_000, 102: 75_000, 103: 30_000 };

let n = 0;
FORGE_ORDER.forEach((bagId, id) => {
  const b = BAGS[bagId];
  if (b.stock) {
    // Stock Bags: bought at the Stonk Exchange with a Robinhood stock token, never shatter.
    writeFileSync(`${OUT}/${id}.json`, JSON.stringify({
      name: b.name,
      description: `${b.desc} ${b.flavor} A legendary Stock Bag from BUNKR, bought with tokenized ${b.stock} on Robinhood Chain plus a $BUNKR burn. Bring it into any run: it never shatters.`,
      image: `${SITE}/nft/${bagId}.png`,
      external_url: SITE,
      attributes: [
        { trait_type: 'Type', value: 'Stock Bag' },
        { trait_type: 'Rarity', value: 'Legendary' },
        { trait_type: 'Stock', value: b.stock },
        { trait_type: 'Shatters', value: 'Never' },
        { trait_type: 'Effect', value: b.desc },
      ],
    }, null, 2));
    n++;
    return;
  }
  writeFileSync(`${OUT}/${id}.json`, JSON.stringify({
    name: b.name,
    description: `${b.desc} ${b.flavor} A forged Bag from BUNKR: bring it into a run, but get liquidated while carrying it and it can shatter.`,
    image: `${SITE}/nft/${bagId}.png`, // full 1024px art, not the in-game icon,
    external_url: SITE,
    attributes: [
      { trait_type: 'Type', value: 'Bag' },
      { trait_type: 'Rarity', value: b.rarity[0].toUpperCase() + b.rarity.slice(1) },
      { trait_type: 'Deed to forge', value: TIERS[BAG_TIER[b.rarity]] },
      { trait_type: 'Burned to forge', display_type: 'number', value: BAG_COST[b.rarity] },
      { trait_type: 'Effect', value: b.desc },
    ],
  }, null, 2));
  n++;
});

for (const c of COSMETICS) {
  writeFileSync(`${OUT}/${c.id}.json`, JSON.stringify({
    name: c.name,
    description: `${c.desc} A BUNKR cosmetic: looks only, zero gameplay, maximum flex.`,
    image: `${SITE}/art/drip/${c.key}.png`,
    external_url: SITE,
    attributes: [
      { trait_type: 'Type', value: 'Cosmetic' },
      { trait_type: 'Slot', value: c.slot === 'bunker' ? 'Bunker' : c.slot === 'nuke' ? 'Nuke' : 'HATCH' },
      { trait_type: 'Deed to forge', value: TIERS[1] },
      { trait_type: 'Burned to forge', display_type: 'number', value: DRIP_COST[c.id] },
    ],
  }, null, 2));
  n++;
}

writeFileSync(`${OUT}/contract.json`, JSON.stringify({
  name: 'BUNKR Forge',
  description: 'Forged Bags and cosmetics from BUNKR, the nuclear-apocalypse bunker game for degens. Every item was made by burning $BUNKR. Bags go into runs and can shatter when you get liquidated. Cosmetics are pure drip.',
  image: `${SITE}/art/drip/goldhatch.png`,
  banner_image: `${SITE}/art/title.webp`,
  external_link: SITE,
}, null, 2));

console.log(`Wrote ${n} item files + contract.json to ${OUT}/ for ${SITE}`);
