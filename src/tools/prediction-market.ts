import { z } from "zod";
import {
  searchMarkets,
  parseOutcomeProbabilities,
  formatVolume,
  type PolymarketMarket,
} from "../providers/polymarket.js";

export const schema = z.object({
  query: z
    .string()
    .describe("Search query for the prediction market, e.g. 'Brazil World Cup', 'France vs Argentina', 'World Cup winner'"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe("Max number of markets to return. Default: 5"),
});

function formatMarket(market: PolymarketMarket) {
  const probabilities = parseOutcomeProbabilities(market);
  const topOutcome = probabilities[0];

  return {
    market_id: market.id,
    question: market.question,
    status: market.closed ? "closed" : market.active ? "active" : "inactive",
    end_date: market.endDate ?? null,
    volume_traded: formatVolume(market.volume),
    liquidity: formatVolume(market.liquidity),
    outcomes: probabilities,
    implied_winner: topOutcome
      ? { outcome: topOutcome.outcome, probability_pct: topOutcome.probability_pct }
      : null,
    url: market.slug ? `https://polymarket.com/event/${market.slug}` : null,
    note: "Prices are from real-money traders on Polymarket (Polygon blockchain). No bookmaker margin — probabilities sum to ~100%.",
  };
}

export async function handler(input: z.infer<typeof schema>) {
  const { query, limit = 5 } = input;

  const markets = await searchMarkets(query, limit);

  if (!markets.length) {
    return {
      found: false,
      message: `No active Polymarket markets found for "${query}".`,
      suggestion: "Try broader terms like 'World Cup winner' or 'FIFA 2026'.",
    };
  }

  const active = markets.filter((m) => m.active && !m.closed);
  const closed = markets.filter((m) => m.closed);

  return {
    source: "Polymarket (decentralized prediction market)",
    query,
    active_markets: active.map(formatMarket),
    closed_markets: closed.length ? closed.map(formatMarket) : undefined,
    interpretation: [
      "Prices represent real-money crowd probabilities — no bookmaker overround.",
      "Higher volume = more reliable market signal.",
      "Compare with get_match_odds to spot divergences between bookmakers and prediction markets.",
    ],
  };
}
