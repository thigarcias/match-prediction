import axios from "axios";

const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";

const client = axios.create({ timeout: 10000 });

export interface PolymarketMarket {
  id: string;
  question: string;
  slug: string;
  description?: string;
  endDate?: string;
  active: boolean;
  closed: boolean;
  volume: number;
  liquidity: number;
  outcomes: string[];         // e.g. ["Yes", "No"] or ["Brazil", "France", "Draw"]
  outcomePrices: string[];    // decimal prices summing to ~1, e.g. ["0.65", "0.35"]
  url?: string;
}

interface GammaMarketsResponse {
  markets?: PolymarketMarket[];
}

export async function searchMarkets(query: string, limit = 10): Promise<PolymarketMarket[]> {
  try {
    const resp = await client.get<PolymarketMarket[]>(`${GAMMA_API}/markets`, {
      params: { q: query, limit, active: true, order: "volume", ascending: false },
    });
    // API returns array directly
    const data = Array.isArray(resp.data) ? resp.data : (resp.data as GammaMarketsResponse).markets ?? [];
    return data;
  } catch {
    return [];
  }
}

export async function getMarketById(marketId: string): Promise<PolymarketMarket | null> {
  try {
    const resp = await client.get<PolymarketMarket>(`${GAMMA_API}/markets/${marketId}`);
    return resp.data;
  } catch {
    return null;
  }
}

export interface CLOBMarketPrice {
  market: string;
  asset_id: string;
  price: number;
}

export async function getMarketPrices(conditionId: string): Promise<CLOBMarketPrice[]> {
  try {
    const resp = await client.get<{ markets: CLOBMarketPrice[] }>(`${CLOB_API}/prices-history`, {
      params: { market: conditionId, interval: "1d", fidelity: 10 },
    });
    return resp.data.markets ?? [];
  } catch {
    return [];
  }
}

export function parseOutcomeProbabilities(market: PolymarketMarket): Array<{ outcome: string; probability_pct: number; price: number }> {
  return market.outcomes.map((outcome, i) => {
    const price = parseFloat(market.outcomePrices[i] ?? "0");
    return {
      outcome,
      price,
      probability_pct: +(price * 100).toFixed(1),
    };
  }).sort((a, b) => b.probability_pct - a.probability_pct);
}

export function formatVolume(volume: number): string {
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(0)}K`;
  return `$${volume.toFixed(0)}`;
}
