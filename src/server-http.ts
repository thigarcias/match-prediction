import "dotenv/config";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMCPServer } from "./create-server.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT ?? 3000;

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "football-world-cup-data MCP", version: "1.0.0" });
});

// Stateless: each request creates a fresh server+transport pair.
// This works perfectly on Railway/Render (persistent process).
app.all("/mcp", async (req, res) => {
  const server = createMCPServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => {
  console.log(`football-world-cup-data MCP server running on port ${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`BSD API: ${process.env.BSD_API_KEY ? "configured ✓" : "not configured (squad/player stats unavailable)"}`);
});
