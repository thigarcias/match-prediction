import { z } from "zod";
import {
  findFixture,
  getFixtureStatistics,
  getFixtureEvents,
  getFixtureLineups,
  isApiFootballAvailable,
  statValue,
} from "../providers/apifootball.js";

export const schema = z.object({
  team1: z.string().describe("One of the teams, e.g. 'Brazil', 'France'"),
  team2: z.string().describe("The opposing team"),
});

export async function handler(input: z.infer<typeof schema>) {
  const { team1, team2 } = input;

  if (!isApiFootballAvailable()) {
    return {
      error: "API-Football key not configured. Set API_FOOTBALL_KEY environment variable.",
      hint: "Get a free key at https://www.api-football.com — 100 requests/day on free tier.",
    };
  }

  const fixture = await findFixture(team1, team2);

  if (!fixture) {
    return {
      found: false,
      message: `No fixture found for ${team1} vs ${team2} in the 2026 World Cup.`,
    };
  }

  const fixtureId = fixture.fixture.id;
  const completed = fixture.fixture.status.short === "FT" || fixture.fixture.status.short === "AET" || fixture.fixture.status.short === "PEN";

  const [stats, events, lineups] = await Promise.all([
    completed ? getFixtureStatistics(fixtureId) : Promise.resolve([]),
    completed ? getFixtureEvents(fixtureId) : Promise.resolve([]),
    getFixtureLineups(fixtureId),
  ]);

  const result: Record<string, unknown> = {
    fixture_id: fixtureId,
    home_team: fixture.teams.home.name,
    away_team: fixture.teams.away.name,
    date: fixture.fixture.date,
    venue: fixture.fixture.venue ? `${fixture.fixture.venue.name}, ${fixture.fixture.venue.city}` : null,
    round: fixture.league.round,
    status: fixture.fixture.status.long,
  };

  if (completed) {
    result.score = {
      fulltime: `${fixture.goals.home}-${fixture.goals.away}`,
      halftime: `${fixture.score.halftime.home}-${fixture.score.halftime.away}`,
    };
  }

  if (stats.length) {
    const buildTeamStats = (teamName: string) => ({
      possession_pct: statValue(stats, teamName, "Ball Possession"),
      shots_total: statValue(stats, teamName, "Total Shots"),
      shots_on_target: statValue(stats, teamName, "Shots on Goal"),
      shots_off_target: statValue(stats, teamName, "Shots off Goal"),
      blocked_shots: statValue(stats, teamName, "Blocked Shots"),
      corners: statValue(stats, teamName, "Corner Kicks"),
      fouls: statValue(stats, teamName, "Fouls"),
      yellow_cards: statValue(stats, teamName, "Yellow Cards"),
      red_cards: statValue(stats, teamName, "Red Cards"),
      offsides: statValue(stats, teamName, "Offsides"),
      passes_total: statValue(stats, teamName, "Total passes"),
      passes_accurate: statValue(stats, teamName, "Passes accurate"),
      pass_accuracy_pct: statValue(stats, teamName, "Passes %"),
      xg: statValue(stats, teamName, "expected_goals"),
    });

    result.team_statistics = {
      home: buildTeamStats(fixture.teams.home.name),
      away: buildTeamStats(fixture.teams.away.name),
    };
  }

  if (events.length) {
    result.match_events = events.map((e) => ({
      minute: e.time.extra ? `${e.time.elapsed}+${e.time.extra}` : `${e.time.elapsed}'`,
      team: e.team.name,
      type: e.type,
      detail: e.detail,
      player: e.player.name,
      assist: e.assist.name ?? null,
    }));
  }

  if (lineups.length) {
    result.lineups = lineups.map((l) => ({
      team: l.team.name,
      formation: l.formation,
      starting_xi: l.startXI.map((p) => `${p.player.number}. ${p.player.name} (${p.player.pos})`),
      substitutes: l.substitutes.map((p) => `${p.player.number}. ${p.player.name} (${p.player.pos})`),
    }));
  }

  if (!completed) {
    result.note = "Match not yet played. Only lineup data (if available) is shown.";
  }

  return result;
}
