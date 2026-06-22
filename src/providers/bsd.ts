import axios, { type AxiosInstance } from "axios";

const API_KEY = process.env.BSD_API_KEY;
const BASE_URL = "https://sports.bzzoiro.com";

function createClient(): AxiosInstance | null {
  if (!API_KEY) return null;
  return axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Token ${API_KEY}` },
    timeout: 10000,
  });
}

const client = createClient();

export function isBSDAvailable(): boolean {
  return client !== null;
}

export interface BSDTeam {
  id: number;
  name: string;
  short_name?: string;
  country?: string;
  logo?: string;
}

export interface BSDFixture {
  id: number;
  date: string;
  home_team: string;
  away_team: string;
  home_score?: number;
  away_score?: number;
  status: string;
  league?: string;
  round?: string;
}

export interface BSDPlayer {
  id: number;
  name: string;
  position?: string;
  club?: string;
  nationality?: string;
  status?: string;
}

export interface BSDStanding {
  position: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  points: number;
}

export interface BSDMatchStats {
  home_possession?: number;
  away_possession?: number;
  home_shots?: number;
  away_shots?: number;
  home_shots_on_target?: number;
  away_shots_on_target?: number;
  home_xg?: number;
  away_xg?: number;
  home_corners?: number;
  away_corners?: number;
  home_yellow_cards?: number;
  away_yellow_cards?: number;
  home_red_cards?: number;
  away_red_cards?: number;
}

export interface BSDPrediction {
  home_win_probability?: number;
  draw_probability?: number;
  away_win_probability?: number;
  predicted_score?: string;
  confidence?: string;
}

export interface BSDWCSquadPlayer {
  id: number;
  team_id: number;
  name: string;
  jersey_number?: number;
  position: string;
  club?: string;
  club_country?: string;
  status?: string;
  caps?: number;
  goals?: number;
  date_of_birth?: string;
  age?: number;
}

async function get<T>(path: string, params?: Record<string, string | number>): Promise<T | null> {
  if (!client) return null;
  try {
    const resp = await client.get<T>(path, { params });
    return resp.data;
  } catch {
    return null;
  }
}

export async function searchTeam(name: string): Promise<BSDTeam[]> {
  const data = await get<{ results: BSDTeam[] }>("/api/v2/teams/", { name, limit: 5 });
  return data?.results ?? [];
}

export async function getTeamFixtures(teamId: number, limit = 10): Promise<BSDFixture[]> {
  const data = await get<{ results: BSDFixture[] }>(`/api/v2/teams/${teamId}/fixtures/`, { limit });
  return data?.results ?? [];
}

export async function getTeamSquad(teamId: number): Promise<BSDPlayer[]> {
  const data = await get<{ results: BSDPlayer[] }>(`/api/v2/teams/${teamId}/squad/`);
  return data?.results ?? [];
}

export async function getWCSquads(): Promise<unknown> {
  return get("/api/v2/worldcup/squads/");
}

export async function getWCSquad(teamId: number): Promise<BSDWCSquadPlayer[]> {
  const data = await get<{ results: BSDWCSquadPlayer[]; count: number }>(`/api/v2/worldcup/squads/${teamId}/`);
  return data?.results ?? [];
}

export async function getLeagueStandings(leagueId: number): Promise<BSDStanding[]> {
  const data = await get<{ results: BSDStanding[] }>(`/api/v2/leagues/${leagueId}/standings/`);
  return data?.results ?? [];
}

export async function getEventStats(eventId: number): Promise<BSDMatchStats | null> {
  return get<BSDMatchStats>(`/api/v2/events/${eventId}/stats/`);
}

export async function getEventPrediction(eventId: number): Promise<BSDPrediction | null> {
  return get<BSDPrediction>(`/api/v2/events/${eventId}/prediction/`);
}

export async function getEventH2H(eventId: number): Promise<unknown> {
  return get(`/api/v2/events/${eventId}/h2h/`);
}

export async function getEventLineups(eventId: number): Promise<unknown> {
  return get(`/api/v2/events/${eventId}/lineups/`);
}

export interface BSDPlayerProfile {
  id: number;
  name: string;
  short_name?: string;
  position?: string;
  specific_position?: string;
  jersey_number?: number;
  date_of_birth?: string;
  height_cm?: number;
  weight_kg?: number;
  preferred_foot?: string;
  nationality?: string;
  current_team_id?: number;
  national_team_id?: number;
  market_value_eur?: number;
  contract_until?: string;
  availability?: string;
  attributes?: {
    tactical?: number;
    attacking?: number;
    defending?: number;
    technical?: number;
    creativity?: number;
  };
  strengths?: string[];
  weaknesses?: string[];
}

export interface BSDPlayerCareerSeason {
  season_id: number;
  league_id: number;
  team_id: number;
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  avg_rating: number;
}

export interface BSDPlayerMatchStat {
  id: number;
  event_id: number;
  team_id: number;
  minutes_played: number;
  rating?: number;
  touches?: number;
  goals: number;
  goal_assist: number;
  expected_goals?: number;
  expected_assists?: number;
  total_shots?: number;
  shots_on_target?: number;
  key_pass?: number;
  total_pass?: number;
  accurate_pass?: number;
  duel_won?: number;
  duel_lost?: number;
  total_tackle?: number;
  won_tackle?: number;
  interception?: number;
  dispossessed?: number;
  was_fouled?: number;
  fouls?: number;
  yellow_card?: number;
  red_card?: number;
}

export interface BSDPlayerNationalTeam {
  player_id: number;
  national_team_id: number;
  caps: number;
  goals: number;
  last_appearance?: string;
}

export interface BSDPlayerSearchResult {
  id: number;
  name: string;
  short_name?: string;
  position?: string;
  date_of_birth?: string;
  nationality?: string;
  current_team_id?: number;
  availability?: string;
}

export async function searchPlayer(name: string): Promise<BSDPlayerSearchResult[]> {
  const data = await get<{ results: BSDPlayerSearchResult[] }>("/api/v2/players/", { name, limit: 5 });
  return data?.results ?? [];
}

export async function getPlayerProfile(playerId: number): Promise<BSDPlayerProfile | null> {
  return get<BSDPlayerProfile>(`/api/v2/players/${playerId}/`);
}

export async function getPlayerCareer(playerId: number): Promise<BSDPlayerCareerSeason[]> {
  const data = await get<{ player_id: number; seasons: BSDPlayerCareerSeason[] }>(`/api/v2/players/${playerId}/career/`);
  return data?.seasons ?? [];
}

export async function getPlayerMatchStats(playerId: number, limit = 20): Promise<BSDPlayerMatchStat[]> {
  const data = await get<{ count: number; results: BSDPlayerMatchStat[] }>(`/api/v2/players/${playerId}/stats/`, { limit });
  return data?.results ?? [];
}

export async function getPlayerNationalTeam(playerId: number): Promise<BSDPlayerNationalTeam | null> {
  return get<BSDPlayerNationalTeam>(`/api/v2/players/${playerId}/national-team/`);
}
