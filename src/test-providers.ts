import "dotenv/config";
import { handler as teamInfoHandler } from "./tools/team-info.js";
import { handler as formHandler } from "./tools/form.js";
import { handler as h2hHandler } from "./tools/head-to-head.js";
import { handler as standingsHandler } from "./tools/standings.js";
import { handler as matchStatsHandler } from "./tools/match-stats.js";
import { handler as squadHandler } from "./tools/squad.js";
import { isBSDAvailable } from "./providers/bsd.js";

console.log("=== Testing football-world-cup-data MCP providers ===\n");

async function run() {
  console.log("1. get_team_info(Brazil)");
  const info = await teamInfoHandler({ team_name: "Brazil" });
  console.log(JSON.stringify(info, null, 2));
  console.log("\n---\n");

  console.log("2. get_team_form(Brazil, wc_2026)");
  const form = await formHandler({ team_name: "Brazil", context: "wc_2026" });
  console.log(JSON.stringify(form, null, 2));
  console.log("\n---\n");

  console.log("3. get_head_to_head(Brazil, Argentina)");
  const h2h = await h2hHandler({ team1: "Brazil", team2: "Argentina" });
  console.log(JSON.stringify(h2h, null, 2));
  console.log("\n---\n");

  console.log("4. get_standings(group: C)");
  const stand = await standingsHandler({ group: "C" });
  console.log(JSON.stringify(stand, null, 2));
  console.log("\n---\n");

  console.log("5. get_match_stats(Brazil, Morocco)");
  const stats = await matchStatsHandler({ team1: "Brazil", team2: "Morocco" });
  console.log(JSON.stringify(stats, null, 2));
  console.log("\n---\n");

  console.log(`6. BSD available: ${isBSDAvailable()}`);
  if (isBSDAvailable()) {
    console.log("\n6a. get_squad(Brazil)");
    const squadResult = await squadHandler({ team_name: "Brazil" });
    console.log(JSON.stringify(squadResult, null, 2));
  }
}

run().catch(console.error);
