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

const tools = [
  {
    name: "get_team_info",
    description:
      "Returns an overview of a national team: World Cup appearances, titles, finals reached, current 2026 group, and upcoming matches. Use this to understand a team's tournament history before deeper analysis.",
    inputSchema: {
      type: "object",
      properties: {
        team_name: { type: "string", description: "Team name, e.g. 'Brazil', 'Argentina', 'Germany'" },
      },
      required: ["team_name"],
    },
    handler: teamInfo.handler,
    schema: teamInfo.schema,
  },
  {
    name: "get_team_form",
    description:
      "Returns a team's match results with goals and scorers. Supports three contexts: 'wc_2026' (matches played so far in the current tournament), 'all_world_cups' (all World Cup matches since 1930), and 'recent' (all competitions via BSD API — requires BSD_API_KEY). Use 'wc_2026' by default for current form.",
    inputSchema: {
      type: "object",
      properties: {
        team_name: { type: "string" },
        context: {
          type: "string",
          enum: ["wc_2026", "all_world_cups", "recent"],
          description: "Data source context. Default: 'wc_2026'",
        },
        last_n: { type: "number", description: "Max matches to return (default 10)" },
      },
      required: ["team_name"],
    },
    handler: form.handler,
    schema: form.schema,
  },
  {
    name: "get_head_to_head",
    description:
      "Returns the complete head-to-head history between two teams across all FIFA World Cup editions (1930-2026). Includes match dates, rounds, scores, goalscorers, and a summary of wins/draws/losses for each side. Limited to World Cup matches only.",
    inputSchema: {
      type: "object",
      properties: {
        team1: { type: "string", description: "First team name" },
        team2: { type: "string", description: "Second team name" },
      },
      required: ["team1", "team2"],
    },
    handler: headToHead.handler,
    schema: headToHead.schema,
  },
  {
    name: "get_standings",
    description:
      "Returns the live FIFA World Cup 2026 group stage standings, including points, goal difference, and match history for each group. Can filter by group letter (A-L) or auto-detect a team's group by name. Also returns completed and upcoming match schedule within the group.",
    inputSchema: {
      type: "object",
      properties: {
        group: { type: "string", description: "Group letter A through L. Omit to get all 12 groups." },
        team_name: { type: "string", description: "Team name to auto-detect their group." },
      },
    },
    handler: standings.handler,
    schema: standings.schema,
  },
  {
    name: "get_match_stats",
    description:
      "Returns match details for a specific game or all games involving a team in the 2026 World Cup. For completed matches: score, half-time score, goalscorers with minutes and type (penalty/own goal). For upcoming matches: date, venue, round.",
    inputSchema: {
      type: "object",
      properties: {
        team1: { type: "string", description: "One of the teams" },
        team2: { type: "string", description: "The opposing team (optional)" },
        round: { type: "string", description: "Filter by round, e.g. 'Matchday 1', 'Quarter-final'" },
      },
      required: ["team1"],
    },
    handler: matchStats.handler,
    schema: matchStats.schema,
  },
  {
    name: "get_player_stats",
    description:
      "Returns detailed statistics for a specific player: profile (position, age, availability, market value, strengths/weaknesses), career summary (goals, assists, minutes per season), national team caps, and per-match stats (xG, xA, rating, pass accuracy, duels, shots, key passes, cards).",
    inputSchema: {
      type: "object",
      properties: {
        player_name: { type: "string", description: "Player name, e.g. 'Neymar', 'Vinicius Junior'" },
        include_match_stats: { type: "boolean", description: "Include per-match breakdown. Default: true" },
        last_n_matches: { type: "number", description: "How many recent matches (1-50). Default: 10" },
      },
      required: ["player_name"],
    },
    handler: playerStats.handler,
    schema: playerStats.schema,
  },
  {
    name: "get_squad",
    description:
      "Returns the World Cup 2026 squad for a national team: player names, positions, clubs, injury/suspension status. Requires BSD_API_KEY for full player data.",
    inputSchema: {
      type: "object",
      properties: {
        team_name: { type: "string", description: "Team name" },
      },
      required: ["team_name"],
    },
    handler: squad.handler,
    schema: squad.schema,
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
