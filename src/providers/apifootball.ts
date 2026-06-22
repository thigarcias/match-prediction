import axios, { type AxiosInstance } from "axios";

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = "https://v3.football.api-sports.io";

function createClient(): AxiosInstance | null {
  if (!API_KEY) return null;
  return axios.create({
    baseURL: BASE_URL,
    headers: { "x-apisports-key": API_KEY },
    timeout: 10000,
  });
}

const client = createClient();

export function isApiFootballAvailable(): boolean {
  return client !== null;
}

async function get<T>(path: string, params?: Record<string, string | number>): Promise<T | null> {
  if (!client) return null;
  try {
    const resp = await client.get<{ response: T }>(path, { params });
    return resp.data.response;
  } catch {
    return null;
  }
}

export interface APIFootballFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; long: string };
    venue: { name: string; city: string } | null;
  };
  league: { name: string; round: string };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
  };
}

export interface APIFootballStatistic {
  team: { id: number; name: string };
  statistics: Array<{ type: string; value: string | number | null }>;
}

export interface APIFootballEvent {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string };
  player: { id: number; name: string };
  assist: { id: number | null; name: string | null };
  type: string;
  detail: string;
}

export interface APIFootballLineupPlayer {
  player: { id: number; name: string; number: number; pos: string };
}

export interface APIFootballLineup {
  team: { id: number; name: string };
  formation: string;
  startXI: APIFootballLineupPlayer[];
  substitutes: APIFootballLineupPlayer[];
}

// FIFA World Cup 2026 league ID is 1 in API-Football
const WC_2026_LEAGUE_ID = 1;
const WC_2026_SEASON = 2026;

export async function searchFixtures(team: string, season = WC_2026_SEASON): Promise<APIFootballFixture[]> {
  // search by team name via teams endpoint first
  const teams = await get<Array<{ team: { id: number; name: string } }>>("/teams", { name: team, league: WC_2026_LEAGUE_ID, season });
  if (!teams?.length) return [];
  const teamId = teams[0].team.id;
  const fixtures = await get<APIFootballFixture[]>("/fixtures", {
    team: teamId,
    league: WC_2026_LEAGUE_ID,
    season,
  });
  return fixtures ?? [];
}

export async function getFixtureById(fixtureId: number): Promise<APIFootballFixture | null> {
  const data = await get<APIFootballFixture[]>("/fixtures", { id: fixtureId });
  return data?.[0] ?? null;
}

export async function getFixtureStatistics(fixtureId: number): Promise<APIFootballStatistic[]> {
  return (await get<APIFootballStatistic[]>("/fixtures/statistics", { fixture: fixtureId })) ?? [];
}

export async function getFixtureEvents(fixtureId: number): Promise<APIFootballEvent[]> {
  return (await get<APIFootballEvent[]>("/fixtures/events", { fixture: fixtureId })) ?? [];
}

export async function getFixtureLineups(fixtureId: number): Promise<APIFootballLineup[]> {
  return (await get<APIFootballLineup[]>("/fixtures/lineups", { fixture: fixtureId })) ?? [];
}

export async function findFixture(team1: string, team2: string): Promise<APIFootballFixture | null> {
  const fixtures = await searchFixtures(team1);
  const t2 = team2.toLowerCase();
  return (
    fixtures.find(
      (f) =>
        f.teams.home.name.toLowerCase().includes(t2) ||
        f.teams.away.name.toLowerCase().includes(t2)
    ) ?? null
  );
}

export function statValue(stats: APIFootballStatistic[], teamName: string, statType: string): string | number | null {
  const teamStats = stats.find((s) => s.team.name.toLowerCase().includes(teamName.toLowerCase()));
  return teamStats?.statistics.find((s) => s.type === statType)?.value ?? null;
}
