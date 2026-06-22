import { z } from "zod";
import { getTeam2026Matches, getTeamHistoricalMatches } from "../providers/worldcup-data.js";
import { searchTeam, getTeamFixtures, isBSDAvailable } from "../providers/bsd.js";

export const schema = z.object({
  team_name: z.string().describe("Team name"),
  context: z
    .enum(["wc_2026", "all_world_cups", "recent"])
    .optional()
    .describe(
      "Which context to fetch form from: 'wc_2026' for current World Cup only (default), 'all_world_cups' for all WC editions, 'recent' for recent club/international matches via BSD API (requires BSD_API_KEY)"
    ),
  last_n: z.number().int().min(1).max(20).optional().describe("Max number of matches to return (default 10)"),
});

export async function handler(input: z.infer<typeof schema>) {
  const { team_name, context = "wc_2026", last_n = 10 } = input;

  if (context === "wc_2026") {
    const matches = await getTeam2026Matches(team_name);
    const completed = matches.filter((m) => m.score).slice(-last_n);
    const upcoming = matches.filter((m) => !m.score);

    return {
      team: team_name,
      context: "FIFA World Cup 2026",
      completed_matches: completed.map((m) => {
        const isHome = m.team1.toLowerCase().includes(team_name.toLowerCase());
        const [gFor, gAgainst] = isHome ? m.score!.ft : [m.score!.ft[1], m.score!.ft[0]];
        const result = gFor > gAgainst ? "W" : gFor < gAgainst ? "L" : "D";
        return {
          date: m.date,
          round: m.round,
          opponent: isHome ? m.team2 : m.team1,
          goals_for: gFor,
          goals_against: gAgainst,
          result,
          scorers: isHome ? (m.goals1 ?? []) : (m.goals2 ?? []),
          venue: m.ground,
        };
      }),
      upcoming_matches: upcoming.map((m) => ({
        date: m.date,
        round: m.round,
        opponent: m.team1.toLowerCase().includes(team_name.toLowerCase()) ? m.team2 : m.team1,
        venue: m.ground,
      })),
      summary: {
        played: completed.length,
        wins: completed.filter((m) => {
          const isHome = m.team1.toLowerCase().includes(team_name.toLowerCase());
          const [gFor, gAgainst] = isHome ? m.score!.ft : [m.score!.ft[1], m.score!.ft[0]];
          return gFor > gAgainst;
        }).length,
        draws: completed.filter((m) => m.score!.ft[0] === m.score!.ft[1]).length,
        losses: completed.filter((m) => {
          const isHome = m.team1.toLowerCase().includes(team_name.toLowerCase());
          const [gFor, gAgainst] = isHome ? m.score!.ft : [m.score!.ft[1], m.score!.ft[0]];
          return gFor < gAgainst;
        }).length,
        goals_for: completed.reduce((sum, m) => {
          const isHome = m.team1.toLowerCase().includes(team_name.toLowerCase());
          return sum + (isHome ? m.score!.ft[0] : m.score!.ft[1]);
        }, 0),
        goals_against: completed.reduce((sum, m) => {
          const isHome = m.team1.toLowerCase().includes(team_name.toLowerCase());
          return sum + (isHome ? m.score!.ft[1] : m.score!.ft[0]);
        }, 0),
      },
    };
  }

  if (context === "all_world_cups") {
    const matches = getTeamHistoricalMatches(team_name);
    const recent = matches.slice(-last_n);
    return {
      team: team_name,
      context: "All FIFA World Cups (1930-2022)",
      total_wc_matches: matches.length,
      matches: recent.map((m) => {
        const isHome = m.team1.toLowerCase().includes(team_name.toLowerCase());
        const [gFor, gAgainst] = isHome ? m.score!.ft : [m.score!.ft[1], m.score!.ft[0]];
        return {
          year: m.year,
          date: m.date,
          round: m.round,
          opponent: isHome ? m.team2 : m.team1,
          goals_for: gFor,
          goals_against: gAgainst,
          result: gFor > gAgainst ? "W" : gFor < gAgainst ? "L" : "D",
        };
      }),
    };
  }

  // context === "recent" — uses BSD
  if (!isBSDAvailable()) {
    return {
      error: "BSD API key not configured. Set BSD_API_KEY environment variable to use this context.",
      hint: "Register free at https://sports.bzzoiro.com/register/ to get a free API key.",
      fallback: "Use context='wc_2026' or 'all_world_cups' for data that requires no API key.",
    };
  }

  const teams = await searchTeam(team_name);
  if (!teams.length) {
    return { error: `Team '${team_name}' not found in BSD database` };
  }
  const team = teams[0];
  const fixtures = await getTeamFixtures(team.id, last_n);

  return {
    team: team.name,
    context: "Recent matches (all competitions via BSD API)",
    matches: fixtures.map((f) => {
      const isHome = f.home_team.toLowerCase().includes(team_name.toLowerCase());
      const gFor = isHome ? f.home_score : f.away_score;
      const gAgainst = isHome ? f.away_score : f.home_score;
      let result = "upcoming";
      if (gFor !== undefined && gAgainst !== undefined) {
        result = gFor > gAgainst ? "W" : gFor < gAgainst ? "L" : "D";
      }
      return {
        date: f.date,
        competition: f.league,
        round: f.round,
        opponent: isHome ? f.away_team : f.home_team,
        goals_for: gFor,
        goals_against: gAgainst,
        result,
        status: f.status,
      };
    }),
  };
}
