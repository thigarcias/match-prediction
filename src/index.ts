import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMCPServer } from "./create-server.js";

const server = createMCPServer();
const transport = new StdioServerTransport();
await server.connect(transport);
