import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initializeDatabase } from "./db/index.js";
import { setDatabase } from "./db/registry.js";
import { registerAllTools } from "./tools/index.js";
import { registerAllResources } from "./resources/index.js";
import { registerAllPrompts } from "./prompts/index.js";

export function createServer(): McpServer {
  const server = new McpServer(
    { name: "memory-worth-mcp", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  registerAllTools(server);
  registerAllResources(server);
  registerAllPrompts(server);

  return server;
}

export async function main(): Promise<void> {
  const db = initializeDatabase();
  setDatabase(db);

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("memory-worth-mcp server running on stdio (tools: 14, resources: 5, prompts: 4)");

  process.on("SIGINT", () => {
    console.error("Shutting down...");
    process.exit(0);
  });
}
