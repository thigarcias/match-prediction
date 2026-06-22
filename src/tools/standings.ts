import { z } from "zod";
import { calculateGroupStandings, get2026Groups, get2026Matches } from "../providers/worldcup-data.js";

export const schema = z.object({
  group: z
    .string()
    .optional()
    .describe(
      "Group letter (A-L) to filter. Omit to get all 12 groups. Example: 'C' for Group C (Brazil's group)."
    ),
  team_name: z
    .string()
    .optional()
    .describe("Instead of specifying a group letter, provide a team name to auto-detect their group."),
});

export async function handler(input: z.infer<typeof schema>) {
  let groupFilter = input.group ? `Group ${input.group.toUpperCase().replace("GROUP ", "")}` : undefined;

  if (!groupFilter && input.team_name) {
    const groups = await get2026Groups();
    const found = groups.find((g) =>
      g.teams.some((t) => t.toLowerCase().includes(input.team_name!.toLowerCase()))
    );
    groupFilter = found?.name;
  }

  const standings = await calculateGroupStandings(groupFilter);
  const matches = await get2026Matches();

  const groupStageMatches = matches.filter((m) => m.group);

  return {
    tournament: "FIFA World Cup 2026",
    as_of: new Date().toISOString().split("T")[0],
    groups: standings.map(({ group, standings: table }) => {
      const groupMatches = groupStageMatches.filter((m) => m.group === group);
      const completed = groupMatches.filter((m) => m.score);
      const upcoming = groupMatches.filter((m) => !m.score);

      return {
        group,
        standings: table.map((row, i) => ({
          position: i + 1,
          team: row.team,
          played: row.played,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          goals_for: row.goals_for,
          goals_against: row.goals_against,
          goal_difference: row.goal_diff,
          points: row.points,
        })),
        completed_matches: completed.map((m) => ({
          date: m.date,
          round: m.round,
          home: m.team1,
          away: m.team2,
          score: `${m.score!.ft[0]}-${m.score!.ft[1]}`,
          ht_score: m.score?.ht ? `${m.score.ht[0]}-${m.score.ht[1]}` : null,
        })),
        upcoming_matches: upcoming.map((m) => ({
          date: m.date,
          round: m.round,
          home: m.team1,
          away: m.team2,
          venue: m.ground,
        })),
      };
    }),
  };
}
