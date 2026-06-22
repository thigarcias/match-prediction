import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import * as teamInfo from "./tools/team-info.js";
import * as form from "./tools/form.js";
import * as headToHead from "./tools/head-to-head.js";
import * as standings from "./tools/standings.js";
import * as matchStats from "./tools/match-stats.js";
import * as squad from "./tools/squad.js";
import * as playerStats from "./tools/player-stats.js";
import * as matchOdds from "./tools/match-odds.js";
import * as matchAdvancedStats from "./tools/match-advanced-stats.js";
import * as predictionMarket from "./tools/prediction-market.js";

const tools = [
  {
    name: "get_team_info",
    description: `
Use this tool FIRST when analyzing any national team. Returns a complete historical profile for the FIFA World Cup 2026.

RETURNS:
- World Cup history: total appearances, titles won, finals and semi-finals reached
- Current 2026 tournament: group assignment, matches played/remaining
- Upcoming fixtures with dates and opponents

WHEN TO USE:
- Starting point before calling get_team_form or get_head_to_head
- When the user asks about a team's World Cup pedigree or tournament history
- To discover which group a team is in before checking standings

DO NOT use to get live match scores or player details — use get_match_stats and get_player_stats for those.
    `.trim(),
    inputSchema: {
      type: "object",
      properties: {
        team_name: {
          type: "string",
          description: "Full English team name. Examples: 'Brazil', 'Argentina', 'Germany', 'France', 'Portugal'. Use the country name, not confederation or city.",
        },
      },
      required: ["team_name"],
    },
    handler: teamInfo.handler,
    schema: teamInfo.schema,
  },
  {
    name: "get_team_form",
    description: `
Returns a team's recent match results including scores and goalscorers. Choose the context based on your analysis goal:

CONTEXTS:
- 'wc_2026' (default): Only matches played in FIFA World Cup 2026. Best for current tournament form.
- 'all_world_cups': Every World Cup match since 1930. Use for long-term historical analysis or head-to-head context.
- 'recent': Recent matches across all competitions (club + national team) via BSD API. Requires BSD_API_KEY env var.

RETURNS per match: date, round, opponent, goals for/against, result (W/D/L), scorers, venue.
Also returns a summary: total played, wins, draws, losses, goals for/against.

WHEN TO USE:
- To assess momentum and current form before predicting a match
- When user asks "how has [team] been playing?" or "are they in good form?"
- Use context='all_world_cups' when analyzing historical patterns or if wc_2026 has too few matches

CHAINING: Call get_team_info first to confirm the team exists, then call this for form data.
    `.trim(),
    inputSchema: {
      type: "object",
      properties: {
        team_name: { type: "string", description: "Team name, e.g. 'Brazil', 'Spain'" },
        context: {
          type: "string",
          enum: ["wc_2026", "all_world_cups", "recent"],
          description: "'wc_2026' for current tournament (default), 'all_world_cups' for full WC history, 'recent' for all competitions (requires BSD_API_KEY)",
        },
        last_n: { type: "number", description: "Number of most recent matches to return. Default: 10. Max: 20." },
      },
      required: ["team_name"],
    },
    handler: form.handler,
    schema: form.schema,
  },
  {
    name: "get_head_to_head",
    description: `
Returns the complete historical record of all matches between two national teams in FIFA World Cup history (1930–2026).

RETURNS:
- Each match: year, date, round, scores, goalscorers
- Summary: wins/draws/losses for each side, total goals

WHEN TO USE:
- Before predicting a match between two teams — historical H2H is a strong predictor signal
- When user asks "who has the advantage historically?" or "have these teams met before?"
- Combine with get_team_form for a complete pre-match analysis

LIMITATION: World Cup matches only. Does not include friendly or qualifier results.
For recent cross-competition results, use get_team_form with context='recent'.

IMPORTANT: Always provide both team names. Order does not matter.
    `.trim(),
    inputSchema: {
      type: "object",
      properties: {
        team1: { type: "string", description: "First team name, e.g. 'Brazil'" },
        team2: { type: "string", description: "Second team name, e.g. 'Argentina'" },
      },
      required: ["team1", "team2"],
    },
    handler: headToHead.handler,
    schema: headToHead.schema,
  },
  {
    name: "get_standings",
    description: `
Returns live FIFA World Cup 2026 group stage standings.

RETURNS:
- Points table: position, team, played, won, drawn, lost, GF, GA, GD, points
- Completed matches in the group with scores
- Upcoming matches with dates and venues

WHEN TO USE:
- To check qualification scenarios ("does Brazil need a win?")
- To understand the stakes of an upcoming match
- When user asks about group standings or who advances
- Provide group letter (A–L) for a specific group, or team_name to auto-detect

If you know the team but not the group, use team_name — it auto-detects the group.
Do not guess group letters; always let the tool resolve them from team names.
    `.trim(),
    inputSchema: {
      type: "object",
      properties: {
        group: { type: "string", description: "Group letter from A to L. Omit if providing team_name." },
        team_name: { type: "string", description: "Team name to auto-detect its group, e.g. 'Brazil'. Use this instead of guessing the group letter." },
      },
    },
    handler: standings.handler,
    schema: standings.schema,
  },
  {
    name: "get_match_stats",
    description: `
Returns match data for FIFA World Cup 2026 fixtures.

FOR COMPLETED MATCHES returns:
- Final score and half-time score
- All goalscorers with exact minutes, penalty and own-goal flags

FOR UPCOMING MATCHES returns:
- Date, time (UTC), venue, round/group

WHEN TO USE:
- To get the result of a match that has already been played
- To find when and where a future match will be played
- Omit team2 to get all matches involving team1 (useful for full schedule overview)
- Use round filter to narrow results, e.g. 'Matchday 1', 'Quarter-final', 'Final'

NOTE: Does not return possession, shots, or xG — use get_match_advanced_stats for those.
    `.trim(),
    inputSchema: {
      type: "object",
      properties: {
        team1: { type: "string", description: "One of the teams. Required." },
        team2: { type: "string", description: "The opposing team. Optional — omit to get all matches for team1." },
        round: { type: "string", description: "Filter by round name. Examples: 'Matchday 1', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final'." },
      },
      required: ["team1"],
    },
    handler: matchStats.handler,
    schema: matchStats.schema,
  },
  {
    name: "get_player_stats",
    description: `
Returns comprehensive statistics for an individual football player. Requires BSD_API_KEY environment variable.

RETURNS:
- Profile: position, age, nationality, height, preferred foot, market value, contract, availability (fit/injured/suspended)
- Strengths and weaknesses (tactical attributes)
- Career summary: total matches, goals, assists, minutes across all tracked seasons
- Per-season breakdown: goals, assists, avg rating, goals per 90
- Recent match stats (last N games): xG, xA, shots, key passes, pass accuracy %, duel win %, tackles, interceptions, cards, rating

WHEN TO USE:
- When analyzing a specific player's contribution or fitness for a match
- To compare players at the same position
- To check injury/suspension status before predicting lineup impact
- Use include_match_stats=false if you only need profile/career data (faster)

NOTE: BSD indexes major leagues; some lower-tier competitions may have incomplete data.
The national team caps field tracks BSD appearances only — not full career international caps.
    `.trim(),
    inputSchema: {
      type: "object",
      properties: {
        player_name: { type: "string", description: "Player full name or common name. Examples: 'Vinicius Junior', 'Kylian Mbappe', 'Erling Haaland', 'Rodri'." },
        include_match_stats: { type: "boolean", description: "Set false to skip per-match breakdown and return only profile + career summary. Default: true." },
        last_n_matches: { type: "number", description: "How many recent matches to analyze (1–50). Default: 10. Use 5 for quick current form, 20+ for deeper patterns." },
      },
      required: ["player_name"],
    },
    handler: playerStats.handler,
    schema: playerStats.schema,
  },
  {
    name: "get_squad",
    description: `
Returns the official FIFA World Cup 2026 squad for a national team.

RETURNS:
- All registered players: name, jersey number, position, club, club country
- Injury and suspension status per player
- Age and caps (when available via BSD_API_KEY)

WHEN TO USE:
- To list who is available for a team before predicting a match
- To check if key players are injured or suspended
- To understand squad depth at each position
- Combine with get_player_stats for individual deep-dives on key players

NOTE: Full player detail (caps, age) requires BSD_API_KEY. Without it, basic squad list is still returned.
    `.trim(),
    inputSchema: {
      type: "object",
      properties: {
        team_name: { type: "string", description: "National team name, e.g. 'Brazil', 'England', 'Japan'." },
      },
      required: ["team_name"],
    },
    handler: squad.handler,
    schema: squad.schema,
  },
  {
    name: "get_match_odds",
    description: `
Returns current betting market odds for FIFA World Cup 2026 matches from multiple bookmakers. Requires ODDS_API_KEY environment variable.

RETURNS per match:
- Odds from each available bookmaker (home win / draw / away win)
- Implied probabilities per bookmaker (raw, including margin)
- Consensus odds: average across all bookmakers
- Normalized market probabilities: overround removed, sum to 100% — use these for fair comparison

WHEN TO USE:
- To understand what the betting market believes about a match outcome
- As one probability signal in a multi-source prediction (combine with get_prediction_market)
- To detect value: if your model gives Brazil 70% but the market gives 55%, that's a divergence
- Omit team2 to see all upcoming odds for team1

HOW TO INTERPRET:
- Normalized home_win_pct / draw_pct / away_win_pct are the cleanest probability estimates
- overround_pct shows the bookmaker's total margin (typically 5–8% for top markets)
- More bookmakers in consensus = more reliable signal

NOTE: Only covers upcoming matches. Past matches have no odds available.
    `.trim(),
    inputSchema: {
      type: "object",
      properties: {
        team1: { type: "string", description: "One of the teams, e.g. 'Brazil', 'France'." },
        team2: { type: "string", description: "The opposing team. Optional — omit to get all upcoming matches for team1." },
      },
      required: ["team1"],
    },
    handler: matchOdds.handler,
    schema: matchOdds.schema,
  },
  {
    name: "get_match_advanced_stats",
    description: `
Returns detailed in-match performance statistics for a FIFA World Cup 2026 fixture. Requires API_FOOTBALL_KEY environment variable.

RETURNS for completed matches:
- Team statistics: possession %, total shots, shots on target, xG, corners, fouls, offsides, pass accuracy %
- Match events: every goal, yellow card, red card and substitution with exact minute and player names
- Lineups and formations for both teams (starting XI + substitutes with positions)

RETURNS for upcoming matches:
- Confirmed lineups and formations (when available pre-match)

WHEN TO USE:
- Deep post-match analysis ("how did Brazil actually play?")
- Checking if a result was lucky (high opponent xG with low shots on target)
- Identifying tactical patterns (formation, pressing metrics via fouls/duels)
- Pre-match: check confirmed lineups before kickoff

DIFFERENCE from get_match_stats:
- get_match_stats → scoreline + goalscorers only (no key required)
- get_match_advanced_stats → full tactical and performance data (requires API_FOOTBALL_KEY)

NOTE: xG field may be null for some matches depending on API-Football coverage.
    `.trim(),
    inputSchema: {
      type: "object",
      properties: {
        team1: { type: "string", description: "One of the teams, e.g. 'Brazil', 'Germany'." },
        team2: { type: "string", description: "The opposing team. Both teams are required for this tool." },
      },
      required: ["team1", "team2"],
    },
    handler: matchAdvancedStats.handler,
    schema: matchAdvancedStats.schema,
  },
  {
    name: "get_prediction_market",
    description: `
Returns crowd-sourced probability estimates from Polymarket, a real-money decentralized prediction market, for FIFA World Cup 2026 events. No API key required.

RETURNS per market:
- Question text (e.g. "Will Brazil win the 2026 World Cup?")
- All outcomes with probability % (derived from market prices)
- Total volume traded in USD (proxy for market confidence)
- Liquidity available
- Market status (active/closed)
- Direct Polymarket URL

WHEN TO USE:
- As a second probability source alongside get_match_odds
- For broader tournament questions: "who wins the group?", "who lifts the trophy?"
- When you want a margin-free probability (Polymarket prices sum to ~100% unlike bookmakers)

HOW TO SEARCH:
- Use natural language: 'Brazil World Cup 2026', 'France win Group', 'World Cup winner'
- Be specific for match markets: 'Brazil vs Argentina' rather than just 'Brazil'
- Try 'World Cup 2026 champion' or 'FIFA winner 2026' for outright winner markets

HOW TO INTERPRET:
- Higher volume = more traders = more reliable signal
- Prices are in USDC (stablecoin), so $1M volume = significant market confidence
- Compare with get_match_odds: if Polymarket gives France 65% but bookmakers give 55%, that divergence is meaningful

LIMITATION: Not all matches have dedicated markets. Main teams and knockout rounds have the most coverage.
    `.trim(),
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language search query. Examples: 'Brazil World Cup 2026', 'France vs Argentina', 'World Cup winner', 'Group A winner'." },
        limit: { type: "number", description: "Max number of markets to return (1–20). Default: 5. Use higher values when searching broad topics like 'World Cup'." },
      },
      required: ["query"],
    },
    handler: predictionMarket.handler,
    schema: predictionMarket.schema,
  },
];

export function createMCPServer(): Server {
  const server = new Server(
    { name: "football-world-cup-data", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      return { content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }], isError: true };
    }
    try {
      const parsed = tool.schema.parse(request.params.arguments ?? {});
      const result = await tool.handler(parsed as never);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  });

  return server;
}
