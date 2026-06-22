import { z } from "zod";
import { get2026Matches } from "../providers/worldcup-data.js";

export const schema = z.object({
  team1: z.string().describe("One of the teams in the match"),
  team2: z.string().optional().describe("The opposing team (optional — if omitted, returns all matches for team1)"),
  round: z.string().optional().describe("Filter by round name, e.g. 'Matchday 1', 'Quarter-final'"),
});

export async function handler(input: z.infer<typeof schema>) {
  const { team1, team2, round } = input;
  const matches = await get2026Matches();

  const filtered = matches.filter((m) => {
    const t1Match =
      m.team1.toLowerCase().includes(team1.toLowerCase()) ||
      m.team2.toLowerCase().includes(team1.toLowerCase());
    if (!t1Match) return false;

    if (team2) {
      const t2Match =
        m.team1.toLowerCase().includes(team2.toLowerCase()) ||
        m.team2.toLowerCase().includes(team2.toLowerCase());
      if (!t2Match) return false;
    }

    if (round) {
      return m.round.toLowerCase().includes(round.toLowerCase());
    }

    return true;
  });

  if (!filtered.length) {
    return {
      found: false,
      message: `No matches found for the given criteria in the 2026 World Cup data.`,
      team1,
      team2: team2 ?? null,
      round: round ?? null,
    };
  }

  return {
    tournament: "FIFA World Cup 2026",
    matches: filtered.map((m) => {
      const completed = !!m.score;
      return {
        date: m.date,
        time_utc: m.time ?? null,
        round: m.round,
        group: m.group ?? null,
        venue: m.ground ?? null,
        home_team: m.team1,
        away_team: m.team2,
        status: completed ? "completed" : "upcoming",
        score: completed ? `${m.score!.ft[0]}-${m.score!.ft[1]}` : null,
        half_time_score: m.score?.ht ? `${m.score.ht[0]}-${m.score.ht[1]}` : null,
        goals: completed
          ? {
              home: (m.goals1 ?? []).map((g) => ({
                scorer: g.name,
                minute: g.minute,
                penalty: g.penalty ?? false,
                own_goal: g.owngoal ?? false,
              })),
              away: (m.goals2 ?? []).map((g) => ({
                scorer: g.name,
                minute: g.minute,
                penalty: g.penalty ?? false,
                own_goal: g.owngoal ?? false,
              })),
            }
          : null,
        note: completed
          ? "Goals data sourced from openfootball. xG and possession not available in free dataset — use BSD_API_KEY for advanced stats."
          : "Match not yet played.",
      };
    }),
  };
}
