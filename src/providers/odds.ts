import axios from "axios";

const API_KEY = process.env.ODDS_API_KEY;
const BASE_URL = "https://api.the-odds-api.com/v4";

export function isOddsAvailable(): boolean {
  return !!API_KEY;
}

export interface OddsOutcome {
  name: string;
  price: number;
}

export interface OddsBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: Array<{
    key: string;
    outcomes: OddsOutcome[];
  }>;
}

export interface OddsEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  if (!API_KEY) return null;
  try {
    const resp = await axios.get<T>(`${BASE_URL}${path}`, {
      params: { apiKey: API_KEY, ...params },
      timeout: 10000,
    });
    return resp.data;
  } catch {
    return null;
  }
}

export async function getSoccerOdds(sportKey = "soccer_fifa_world_cup"): Promise<OddsEvent[]> {
  const data = await get<OddsEvent[]>(`/sports/${sportKey}/odds`, {
    regions: "eu",
    markets: "h2h",
    oddsFormat: "decimal",
  });
  return data ?? [];
}

export async function getEventOdds(eventId: string, sportKey = "soccer_fifa_world_cup"): Promise<OddsEvent | null> {
  const data = await get<OddsEvent[]>(`/sports/${sportKey}/odds`, {
    regions: "eu",
    markets: "h2h,totals",
    oddsFormat: "decimal",
    eventIds: eventId,
  });
  return data?.[0] ?? null;
}

export function oddsToImpliedProbability(odd: number): number {
  return +(1 / odd * 100).toFixed(1);
}

export function normalizeMarketProbabilities(home: number, draw: number, away: number) {
  const total = home + draw + away;
  return {
    home_win_pct: +((home / total) * 100).toFixed(1),
    draw_pct: +((draw / total) * 100).toFixed(1),
    away_win_pct: +((away / total) * 100).toFixed(1),
    overround_pct: +((total - 100)).toFixed(1),
  };
}
