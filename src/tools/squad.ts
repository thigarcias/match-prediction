import { z } from "zod";
import { get2026Groups, findTeamGroup } from "../providers/worldcup-data.js";
import { searchTeam, getWCSquad, isBSDAvailable } from "../providers/bsd.js";

export const schema = z.object({
  team_name: z.string().describe("Team name to get the World Cup squad for"),
});

export async function handler(input: z.infer<typeof schema>) {
  const { team_name } = input;

  if (!isBSDAvailable()) {
    const groups = await get2026Groups();
    const group = findTeamGroup(team_name, groups);

    return {
      team: team_name,
      wc_2026_group: group?.name ?? "Not found in 2026 World Cup",
      squad: null,
      error:
        "Detailed squad data (player names, positions, clubs) requires the BSD API key. " +
        "Set BSD_API_KEY environment variable after registering free at https://sports.bzzoiro.com/register/",
      note:
        "Group placement confirmed from openfootball data. " +
        "For squad analysis without the API key, consider asking the model to use general knowledge about the team.",
    };
  }

  // Search for the team in BSD
  const teams = await searchTeam(team_name);
  if (!teams.length) {
    return { error: `Team '${team_name}' not found in BSD database` };
  }

  const team = teams[0];
  const squad = await getWCSquad(team.id);

  const groups = await get2026Groups();
  const group = findTeamGroup(team_name, groups);

  const positionOrder = ["GK", "DF", "MF", "FW"];
  const byPosition: Record<string, Array<{ name: string; jersey: number | undefined; club: string | undefined; club_country: string | undefined; caps: number | undefined; goals: number | undefined; age: number | undefined; status: string | undefined }>> = {};

  for (const player of squad) {
    const pos = player.position ?? "Unknown";
    if (!byPosition[pos]) byPosition[pos] = [];
    byPosition[pos].push({
      name: player.name,
      jersey: player.jersey_number,
      club: player.club,
      club_country: player.club_country,
      caps: player.caps,
      goals: player.goals,
      age: player.age,
      status: player.status,
    });
  }

  // Sort by jersey number within each position
  for (const pos of Object.keys(byPosition)) {
    byPosition[pos].sort((a, b) => (a.jersey ?? 99) - (b.jersey ?? 99));
  }

  const unavailable = squad.filter(
    (p) => p.status && !p.status.toLowerCase().includes("official")
  );

  return {
    team: team.name,
    wc_2026_group: group?.name ?? null,
    total_players: squad.length,
    squad_by_position: Object.fromEntries(
      positionOrder
        .filter((pos) => byPosition[pos]?.length)
        .map((pos) => [pos, byPosition[pos]])
    ),
    unavailable: unavailable.length > 0
      ? unavailable.map((p) => ({ name: p.name, position: p.position, status: p.status }))
      : null,
    data_source: "BSD (Bzzoiro Sports Data) — World Cup 2026 squads endpoint",
  };
}
