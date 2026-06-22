import { z } from "zod";
import { getHistoricalEditions, get2026Matches, get2026Groups, findTeamGroup } from "../providers/worldcup-data.js";

export const schema = z.object({
  team_name: z.string().describe("Team name (e.g. 'Brazil', 'Argentina', 'France')"),
});

export async function handler(input: z.infer<typeof schema>) {
  const { team_name } = input;
  const editions = getHistoricalEditions();

  const appearances: number[] = [];
  let wins = 0;
  let finals = 0;

  for (const edition of editions) {
    const played = edition.matches.some(
      (m) =>
        m.score &&
        (m.team1.toLowerCase().includes(team_name.toLowerCase()) ||
          m.team2.toLowerCase().includes(team_name.toLowerCase()))
    );
    if (played) appearances.push(edition.year);

    // Check if won (won the final)
    const final = edition.matches.find(
      (m) => /^(final|final round)$/i.test(m.round.trim())
    );
    if (final && final.score) {
      const t1Match = final.team1.toLowerCase().includes(team_name.toLowerCase());
      const t2Match = final.team2.toLowerCase().includes(team_name.toLowerCase());
      if (t1Match || t2Match) {
        finals++;
        // Prefer penalty shootout result if available, otherwise FT
        const decisive: [number, number] = final.score.p ?? final.score.ft;
        const [g1, g2] = decisive;
        if ((t1Match && g1 > g2) || (t2Match && g2 > g1)) wins++;
      }
    }
  }

  // Check 2026 participation
  const [matches2026, groups] = await Promise.all([get2026Matches(), get2026Groups()]);
  const in2026 = matches2026.some(
    (m) =>
      m.team1.toLowerCase().includes(team_name.toLowerCase()) ||
      m.team2.toLowerCase().includes(team_name.toLowerCase())
  );
  const group2026 = in2026 ? findTeamGroup(team_name, groups) : undefined;

  const wc2026Matches = matches2026.filter(
    (m) =>
      m.team1.toLowerCase().includes(team_name.toLowerCase()) ||
      m.team2.toLowerCase().includes(team_name.toLowerCase())
  );
  const completed2026 = wc2026Matches.filter((m) => m.score);
  const pending2026 = wc2026Matches.filter((m) => !m.score);

  return {
    team: team_name,
    world_cup_appearances: appearances.length,
    world_cup_years: appearances,
    world_cup_wins: wins,
    world_cup_finals: finals,
    in_wc_2026: in2026,
    wc_2026_group: group2026?.name ?? null,
    wc_2026_group_teams: group2026?.teams ?? null,
    wc_2026_matches_played: completed2026.length,
    wc_2026_matches_remaining: pending2026.length,
    wc_2026_upcoming: pending2026.map((m) => ({
      date: m.date,
      opponent: m.team1.toLowerCase().includes(team_name.toLowerCase()) ? m.team2 : m.team1,
      venue: m.ground,
      round: m.round,
    })),
    note: "Data sourced from openfootball public domain dataset",
  };
}
