import axios from "axios";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");

export interface Goal {
  name: string;
  minute: string;
  penalty?: boolean;
  owngoal?: boolean;
}

export interface Score {
  ft: [number, number];
  ht?: [number, number];
  et?: [number, number];
  p?: [number, number];
}

export interface WCMatch {
  round: string;
  date: string;
  time?: string;
  team1: string;
  team2: string;
  score?: Score;
  goals1?: Goal[];
  goals2?: Goal[];
  group?: string;
  ground?: string;
}

export interface WCEdition {
  year: number;
  name: string;
  matches: WCMatch[];
}

export interface WCGroup {
  name: string;
  teams: string[];
}

interface CachedData<T> {
  data: T;
  fetchedAt: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

let wc2026Cache: CachedData<WCMatch[]> | null = null;
let groupsCache: CachedData<WCGroup[]> | null = null;

function loadJson<T>(filename: string): T {
  let raw = readFileSync(join(DATA_DIR, filename), "utf-8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // strip UTF-8 BOM
  return JSON.parse(raw) as T;
}

function loadHistoricalEditions(): WCEdition[] {
  const entries = loadJson<Array<{ year: number; data: { name: string; matches: WCMatch[] } }>>("worldcup-history.json");
  return entries.map((e) => ({ year: e.year, name: e.data.name, matches: e.data.matches }));
}

const historicalEditions: WCEdition[] = loadHistoricalEditions();

async function fetch2026Matches(): Promise<WCMatch[]> {
  const now = Date.now();
  if (wc2026Cache && now - wc2026Cache.fetchedAt < CACHE_TTL_MS) {
    return wc2026Cache.data;
  }
  try {
    const url =
      "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";
    const resp = await axios.get<{ matches: WCMatch[] }>(url, { timeout: 8000 });
    wc2026Cache = { data: resp.data.matches, fetchedAt: now };
    return resp.data.matches;
  } catch {
    return loadJson<{ matches: WCMatch[] }>("worldcup-2026.json").matches;
  }
}

async function fetch2026Groups(): Promise<WCGroup[]> {
  const now = Date.now();
  if (groupsCache && now - groupsCache.fetchedAt < CACHE_TTL_MS) {
    return groupsCache.data;
  }
  try {
    const url =
      "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.groups.json";
    const resp = await axios.get<{ groups: WCGroup[] }>(url, { timeout: 8000 });
    groupsCache = { data: resp.data.groups, fetchedAt: now };
    return resp.data.groups;
  } catch {
    return loadJson<{ groups: WCGroup[] }>("worldcup-2026-groups.json").groups;
  }
}

function normalizeTeamName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

function teamMatches(name: string, matches: WCMatch[]): boolean {
  const n = normalizeTeamName(name);
  return normalizeTeamName(matches[0]?.team1 ?? "") === n ||
    normalizeTeamName(matches[0]?.team2 ?? "") === n;
}

function matchesTeam(match: WCMatch, name: string): boolean {
  const n = normalizeTeamName(name);
  return normalizeTeamName(match.team1) === n || normalizeTeamName(match.team2) === n;
}

function matchesH2H(match: WCMatch, t1: string, t2: string): boolean {
  const n1 = normalizeTeamName(t1);
  const n2 = normalizeTeamName(t2);
  const m1 = normalizeTeamName(match.team1);
  const m2 = normalizeTeamName(match.team2);
  return (m1 === n1 && m2 === n2) || (m1 === n2 && m2 === n1);
}

export function getHistoricalEditions(): WCEdition[] {
  return historicalEditions;
}

export async function get2026Matches(): Promise<WCMatch[]> {
  return fetch2026Matches();
}

export async function get2026Groups(): Promise<WCGroup[]> {
  return fetch2026Groups();
}

export async function getTeam2026Matches(teamName: string): Promise<WCMatch[]> {
  const matches = await fetch2026Matches();
  return matches.filter((m) => matchesTeam(m, teamName));
}

export function getTeamHistoricalMatches(teamName: string): Array<WCMatch & { year: number }> {
  const results: Array<WCMatch & { year: number }> = [];
  for (const edition of historicalEditions) {
    for (const match of edition.matches) {
      if (matchesTeam(match, teamName) && match.score) {
        results.push({ ...match, year: edition.year });
      }
    }
  }
  return results;
}

export function getH2HHistory(team1: string, team2: string): Array<WCMatch & { year: number }> {
  const results: Array<WCMatch & { year: number }> = [];
  for (const edition of historicalEditions) {
    for (const match of edition.matches) {
      if (matchesH2H(match, team1, team2) && match.score) {
        results.push({ ...match, year: edition.year });
      }
    }
  }
  return results;
}

export async function getH2H2026(team1: string, team2: string): Promise<WCMatch[]> {
  const matches = await fetch2026Matches();
  return matches.filter((m) => matchesH2H(m, team1, team2));
}

export interface GroupStanding {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
}

export async function calculateGroupStandings(groupName?: string): Promise<{ group: string; standings: GroupStanding[] }[]> {
  const [matches, groups] = await Promise.all([fetch2026Matches(), fetch2026Groups()]);

  const standings: Map<string, Map<string, GroupStanding>> = new Map();

  for (const group of groups) {
    if (groupName && group.name.toLowerCase() !== groupName.toLowerCase()) continue;
    const teamMap = new Map<string, GroupStanding>();
    for (const team of group.teams) {
      teamMap.set(normalizeTeamName(team), {
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goals_for: 0,
        goals_against: 0,
        goal_diff: 0,
        points: 0,
      });
    }
    standings.set(group.name, teamMap);
  }

  const groupStageMatches = matches.filter((m) => m.group && m.score);

  for (const match of groupStageMatches) {
    if (!match.group || !match.score) continue;
    const groupMap = standings.get(match.group);
    if (!groupMap) continue;

    const t1 = normalizeTeamName(match.team1);
    const t2 = normalizeTeamName(match.team2);
    const s1 = groupMap.get(t1);
    const s2 = groupMap.get(t2);
    if (!s1 || !s2) continue;

    const [g1, g2] = match.score.ft;
    s1.played++;
    s2.played++;
    s1.goals_for += g1;
    s1.goals_against += g2;
    s2.goals_for += g2;
    s2.goals_against += g1;

    if (g1 > g2) {
      s1.won++;
      s1.points += 3;
      s2.lost++;
    } else if (g1 < g2) {
      s2.won++;
      s2.points += 3;
      s1.lost++;
    } else {
      s1.drawn++;
      s2.drawn++;
      s1.points++;
      s2.points++;
    }
  }

  const result: { group: string; standings: GroupStanding[] }[] = [];
  for (const [groupName, teamMap] of standings.entries()) {
    const sorted = [...teamMap.values()]
      .map((s) => ({ ...s, goal_diff: s.goals_for - s.goals_against }))
      .sort((a, b) => b.points - a.points || b.goal_diff - a.goal_diff || b.goals_for - a.goals_for);
    result.push({ group: groupName, standings: sorted });
  }

  return result.sort((a, b) => a.group.localeCompare(b.group));
}

export function findTeamGroup(teamName: string, groups: WCGroup[]): WCGroup | undefined {
  const n = normalizeTeamName(teamName);
  return groups.find((g) => g.teams.some((t) => normalizeTeamName(t) === n));
}
