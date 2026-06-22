import { z } from "zod";
import { getH2HHistory, getH2H2026 } from "../providers/worldcup-data.js";

export const schema = z.object({
  team1: z.string().describe("First team name"),
  team2: z.string().describe("Second team name"),
});

export async function handler(input: z.infer<typeof schema>) {
  const { team1, team2 } = input;

  const [historical, current2026] = await Promise.all([
    Promise.resolve(getH2HHistory(team1, team2)),
    getH2H2026(team1, team2),
  ]);

  const all = [...historical, ...current2026.filter((m) => m.score).map((m) => ({ ...m, year: 2026 as const }))];

  let t1_wins = 0;
  let t2_wins = 0;
  let draws = 0;

  const matches = all.map((m) => {
    const t1IsHome = m.team1.toLowerCase().includes(team1.toLowerCase());
    const [g1, g2] = m.score!.ft;
    const [gFor, gAgainst] = t1IsHome ? [g1, g2] : [g2, g1];

    if (gFor > gAgainst) t1_wins++;
    else if (gFor < gAgainst) t2_wins++;
    else draws++;

    return {
      year: m.year,
      date: m.date,
      round: m.round,
      group: m.group ?? null,
      home_team: m.team1,
      away_team: m.team2,
      score: `${g1}-${g2}`,
      winner: g1 > g2 ? m.team1 : g1 < g2 ? m.team2 : "Draw",
      goals_team1: (m as { goals1?: unknown }).goals1 ?? [],
      goals_team2: (m as { goals2?: unknown }).goals2 ?? [],
      venue: m.ground ?? null,
    };
  });

  const totalGoalsForT1 = matches.reduce((sum, m) => {
    const isHome = m.home_team.toLowerCase().includes(team1.toLowerCase());
    const [g1, g2] = m.score.split("-").map(Number);
    return sum + (isHome ? g1 : g2);
  }, 0);

  const totalGoalsForT2 = matches.reduce((sum, m) => {
    const isHome = m.home_team.toLowerCase().includes(team2.toLowerCase());
    const [g1, g2] = m.score.split("-").map(Number);
    return sum + (isHome ? g1 : g2);
  }, 0);

  return {
    team1,
    team2,
    context: "FIFA World Cup only (all editions 1930-2026)",
    total_matches: all.length,
    [`${team1}_wins`]: t1_wins,
    draws,
    [`${team2}_wins`]: t2_wins,
    [`${team1}_goals_total`]: totalGoalsForT1,
    [`${team2}_goals_total`]: totalGoalsForT2,
    avg_goals_per_match: all.length > 0 ? ((totalGoalsForT1 + totalGoalsForT2) / all.length).toFixed(1) : null,
    matches: matches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  };
}
