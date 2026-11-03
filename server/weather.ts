// The $BUNKR chart is the wasteland's weather. Read from a public price feed once the coin
// trades; until then (testnet) it's a calm crab market. WEATHER=bull|winter|calm forces it.
import type { MarketEvent, Weather } from '../src/sim/types';

export interface WeatherReport {
  kind: Weather;
  change24h: number | null;
  change1h: number | null;
  source: string;
}

const SWING = 8; // percent

let cache: { at: number; report: WeatherReport } | null = null;

export async function getWeather(): Promise<WeatherReport> {
  const forced = process.env.WEATHER as Weather | undefined;
  if (forced === 'bull' || forced === 'winter' || forced === 'calm') {
    return { kind: forced, change24h: null, change1h: Number(process.env.WEATHER_1H ?? 0), source: 'forced' };
  }
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.report;
  const token = process.env.WEATHER_TOKEN;
  let report: WeatherReport = { kind: 'calm', change24h: null, change1h: null, source: 'none' };
  if (token) {
    try {
      // DEX Screener's public API: price change for the token's most liquid pair.
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`);
      const json = (await res.json()) as { pairs?: { liquidity?: { usd?: number }; priceChange?: { h1?: number; h24?: number } }[] };
      const pair = [...(json.pairs ?? [])].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
      const d24 = pair?.priceChange?.h24 ?? null;
      const d1 = pair?.priceChange?.h1 ?? null;
      report = { kind: d24 == null ? 'calm' : d24 >= SWING ? 'bull' : d24 <= -SWING ? 'winter' : 'calm', change24h: d24, change1h: d1, source: 'dexscreener' };
    } catch {
      report = { kind: 'calm', change24h: null, change1h: null, source: 'unavailable' };
    }
  }
  cache = { at: Date.now(), report };
  return report;
}

/** A big move in the last hour becomes that day's market event. */
export async function marketEventNow(): Promise<MarketEvent | null> {
  const w = await getWeather();
  if (w.change1h == null) return null;
  return w.change1h >= SWING ? 'whale' : w.change1h <= -SWING ? 'paperstorm' : null;
}
