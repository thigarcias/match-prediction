import { z } from "zod";
import {
  getSoccerOdds,
  oddsToImpliedProbability,
  normalizeMarketProbabilities,
  isOddsAvailable,
  type OddsEvent,
} from "../providers/odds.js";

export const schema = z.object({
  team1: z.string().describe("One of the teams, e.g. 'Brazil', 'France'"),
  team2: z.string().optional().describe("The opposing team (optional — if omitted, returns all available matches)"),
});

function findMatch(events: OddsEvent[], team1: string, team2?: string): OddsEvent[] {
  const t1 = team1.toLowerCase();
  const t2 = team2?.toLowerCase();
  return events.filter((e) => {
    const home = e.home_team.toLowerCase();
    const away = e.away_team.toLowerCase();
    const t1Match = home.includes(t1) || away.includes(t1);
    if (!t1Match) return false;
    if (t2) return home.includes(t2) || away.includes(t2);
    return true;
  });
}

function summarizeBookmaker(event: OddsEvent) {
  return event.bookmakers.map((bm) => {
    const h2h = bm.markets.find((m) => m.key === "h2h");
    if (!h2h) return null;

    const homeOdd = h2h.outcomes.find((o) => o.name === event.home_team)?.price;
    const awayOdd = h2h.outcomes.find((o) => o.name === event.away_team)?.price;
    const drawOdd = h2h.outcomes.find((o) => o.name === "Draw")?.price;

    if (!homeOdd || !awayOdd || !drawOdd) return null;

    return {
      bookmaker: bm.title,
      odds: {
        home_win: homeOdd,
        draw: drawOdd,
        away_win: awayOdd,
      },
      implied_probabilities: {
        home_win_pct: oddsToImpliedProbability(homeOdd),
        draw_pct: oddsToImpliedProbability(drawOdd),
        away_win_pct: oddsToImpliedProbability(awayOdd),
      },
    };
  }).filter(Boolean);
}

function consensusOdds(event: OddsEvent) {
  const allH2H = event.bookmakers
    .map((bm) => bm.markets.find((m) => m.key === "h2h"))
    .filter(Boolean);

  if (!allH2H.length) return null;

  const homeOdds = allH2H.flatMap((m) => m!.outcomes.filter((o) => o.name === event.home_team).map((o) => o.price));
  const awayOdds = allH2H.flatMap((m) => m!.outcomes.filter((o) => o.name === event.away_team).map((o) => o.price));
  const drawOdds = allH2H.flatMap((m) => m!.outcomes.filter((o) => o.name === "Draw").map((o) => o.price));

  const avg = (arr: number[]) => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : null;

  const avgHome = avg(homeOdds);
  const avgDraw = avg(drawOdds);
  const avgAway = avg(awayOdds);

  if (!avgHome || !avgDraw || !avgAway) return null;

  const raw = {
    home: oddsToImpliedProbability(avgHome),
    draw: oddsToImpliedProbability(avgDraw),
    away: oddsToImpliedProbability(avgAway),
  };

  return {
    avg_odds: { home_win: avgHome, draw: avgDraw, away_win: avgAway },
    market_implied_probabilities: normalizeMarketProbabilities(raw.home, raw.draw, raw.away),
    bookmakers_count: event.bookmakers.length,
  };
}

export async function handler(input: z.infer<typeof schema>) {
  const { team1, team2 } = input;

  if (!isOddsAvailable()) {
    return {
      error: "Odds API key not configured. Set ODDS_API_KEY environment variable.",
      hint: "Get a free key at https://the-odds-api.com — 500 requests/month on free tier.",
    };
  }

  const events = await getSoccerOdds();
  const matches = findMatch(events, team1, team2);

  if (!matches.length) {
    return {
      found: false,
      message: `No upcoming odds found for ${team1}${team2 ? ` vs ${team2}` : ""}. Match may not be listed yet or has already started.`,
    };
  }

  return {
    tournament: "FIFA World Cup 2026",
    matches: matches.map((event) => {
      const consensus = consensusOdds(event);
      return {
        home_team: event.home_team,
        away_team: event.away_team,
        commence_time: event.commence_time,
        consensus,
        bookmakers: summarizeBookmaker(event),
        note: "Odds convert to implied probability including bookmaker margin. Normalized probabilities remove the overround for a fair comparison.",
      };
    }),
  };
}
