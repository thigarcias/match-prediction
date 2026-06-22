import { z } from "zod";
import {
  searchPlayer,
  getPlayerProfile,
  getPlayerCareer,
  getPlayerMatchStats,
  getPlayerNationalTeam,
  isBSDAvailable,
} from "../providers/bsd.js";

export const schema = z.object({
  player_name: z.string().describe("Player name, e.g. 'Neymar', 'Vinicius Junior', 'Kylian Mbappe'"),
  include_match_stats: z
    .boolean()
    .optional()
    .describe("Include per-match stats (xG, passes, duels, rating). Default: true"),
  last_n_matches: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Number of recent matches to return stats for. Default: 10"),
});

export async function handler(input: z.infer<typeof schema>) {
  const { player_name, include_match_stats = true, last_n_matches = 10 } = input;

  if (!isBSDAvailable()) {
    return {
      error: "BSD API key not configured. Set BSD_API_KEY to use player stats.",
      hint: "Register free at https://sports.bzzoiro.com/register/",
    };
  }

  const results = await searchPlayer(player_name);
  if (!results.length) {
    return { error: `Player '${player_name}' not found in BSD database.` };
  }

  // Prefer national team players and exact name matches
  const best =
    results.find((p) => p.name.toLowerCase() === player_name.toLowerCase()) ??
    results.find((p) => p.nationality !== null) ??
    results[0];

  const [profile, career, nationalTeam, matchStats] = await Promise.all([
    getPlayerProfile(best.id),
    getPlayerCareer(best.id),
    getPlayerNationalTeam(best.id),
    include_match_stats ? getPlayerMatchStats(best.id, last_n_matches) : Promise.resolve([]),
  ]);

  // Aggregate career totals
  const careerTotals = career.reduce(
    (acc, s) => ({
      matches: acc.matches + s.matches,
      minutes: acc.minutes + s.minutes,
      goals: acc.goals + s.goals,
      assists: acc.assists + s.assists,
      seasons: acc.seasons + 1,
    }),
    { matches: 0, minutes: 0, goals: 0, assists: 0, seasons: 0 }
  );

  // Aggregate match stats
  const matchAggregates =
    matchStats.length > 0
      ? {
          matches_analyzed: matchStats.length,
          avg_rating: avg(matchStats.map((m) => m.rating).filter(notNull)),
          avg_xg_per_game: avg(matchStats.map((m) => m.expected_goals).filter(notNull)),
          avg_xa_per_game: avg(matchStats.map((m) => m.expected_assists).filter(notNull)),
          total_goals: sum(matchStats, "goals"),
          total_assists: sum(matchStats, "goal_assist"),
          avg_shots_per_game: avg(matchStats.map((m) => m.total_shots).filter(notNull)),
          avg_key_passes_per_game: avg(matchStats.map((m) => m.key_pass).filter(notNull)),
          avg_pass_accuracy_pct: avgRatio(matchStats, "accurate_pass", "total_pass"),
          avg_duels_won_pct: avgRatio(matchStats, "duel_won", (m) => (m.duel_won ?? 0) + (m.duel_lost ?? 0)),
          avg_minutes_per_game: avg(matchStats.map((m) => m.minutes_played)),
          yellow_cards: sum(matchStats, "yellow_card"),
          red_cards: sum(matchStats, "red_card"),
        }
      : null;

  return {
    player: {
      name: profile?.name ?? best.name,
      position: profile?.position ?? best.position,
      specific_position: profile?.specific_position ?? null,
      nationality: profile?.nationality ?? best.nationality,
      date_of_birth: profile?.date_of_birth ?? best.date_of_birth,
      age: profile?.date_of_birth ? calcAge(profile.date_of_birth) : null,
      height_cm: profile?.height_cm ?? null,
      preferred_foot: profile?.preferred_foot ?? null,
      availability: profile?.availability ?? best.availability,
      market_value_eur: profile?.market_value_eur ?? null,
      contract_until: profile?.contract_until ?? null,
      attributes: profile?.attributes ?? null,
      strengths: profile?.strengths ?? [],
      weaknesses: profile?.weaknesses ?? [],
    },
    national_team:
      nationalTeam
        ? {
            caps_tracked_by_bsd: nationalTeam.caps,
            goals_tracked_by_bsd: nationalTeam.goals,
            last_appearance: nationalTeam.last_appearance ?? null,
            note: "BSD tracks a subset of national team appearances; may not reflect full career caps.",
          }
        : null,
    career_summary: {
      note: "Covers only leagues and seasons indexed by BSD (may not be full career)",
      seasons_tracked: careerTotals.seasons,
      total_matches: careerTotals.matches,
      total_minutes: careerTotals.minutes,
      total_goals: careerTotals.goals,
      total_assists: careerTotals.assists,
      goals_per_90: careerTotals.minutes > 0
        ? +((careerTotals.goals / careerTotals.minutes) * 90).toFixed(2)
        : null,
      assists_per_90: careerTotals.minutes > 0
        ? +((careerTotals.assists / careerTotals.minutes) * 90).toFixed(2)
        : null,
    },
    career_seasons: career.map((s) => ({
      season_id: s.season_id,
      league_id: s.league_id,
      team_id: s.team_id,
      matches: s.matches,
      minutes: s.minutes,
      goals: s.goals,
      assists: s.assists,
      avg_rating: s.avg_rating,
      goals_per_90: s.minutes > 0 ? +((s.goals / s.minutes) * 90).toFixed(2) : null,
    })),
    recent_match_stats_aggregated: matchAggregates,
    recent_matches: include_match_stats
      ? matchStats.map((m) => ({
          event_id: m.event_id,
          minutes_played: m.minutes_played,
          rating: m.rating ?? null,
          goals: m.goals,
          assists: m.goal_assist,
          xg: m.expected_goals ?? null,
          xa: m.expected_assists ?? null,
          shots: m.total_shots ?? null,
          shots_on_target: m.shots_on_target ?? null,
          key_passes: m.key_pass ?? null,
          pass_accuracy_pct:
            m.total_pass && m.accurate_pass
              ? +(((m.accurate_pass / m.total_pass) * 100)).toFixed(1)
              : null,
          duel_win_rate_pct:
            m.duel_won !== undefined && m.duel_lost !== undefined && (m.duel_won + m.duel_lost) > 0
              ? +(((m.duel_won / (m.duel_won + m.duel_lost)) * 100)).toFixed(1)
              : null,
          tackles_won: m.won_tackle ?? null,
          interceptions: m.interception ?? null,
          was_fouled: m.was_fouled ?? null,
          yellow_card: m.yellow_card ?? 0,
          red_card: m.red_card ?? 0,
        }))
      : [],
    data_source: "BSD (Bzzoiro Sports Data)",
  };
}

function notNull<T>(v: T | null | undefined): v is T {
  return v !== null && v !== undefined;
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(3);
}

type MatchStatKey = keyof import("../providers/bsd.js").BSDPlayerMatchStat;

function sum(matches: import("../providers/bsd.js").BSDPlayerMatchStat[], key: MatchStatKey): number {
  return matches.reduce((acc, m) => acc + ((m[key] as number) ?? 0), 0);
}

function avgRatio(
  matches: import("../providers/bsd.js").BSDPlayerMatchStat[],
  numeratorKey: MatchStatKey,
  denominatorArg: MatchStatKey | ((m: import("../providers/bsd.js").BSDPlayerMatchStat) => number)
): number | null {
  const ratios = matches
    .map((m) => {
      const num = (m[numeratorKey] as number) ?? 0;
      const den =
        typeof denominatorArg === "string"
          ? ((m[denominatorArg] as number) ?? 0)
          : denominatorArg(m);
      return den > 0 ? num / den : null;
    })
    .filter(notNull);
  if (!ratios.length) return null;
  return +((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100).toFixed(1);
}

function calcAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
