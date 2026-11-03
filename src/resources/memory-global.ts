import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../db/registry.js";

export function registerMemoryGlobalResource(server: McpServer): void {
  server.registerResource(
    "memory-global",
    "memory://global/memories",
    {
      title: "Global Memories",
      description: "Active global-scope memories as a JSON list (most recently updated first, capped at 100)",
      mimeType: "application/json",
    },
    async (uri) => {
      const rows = getDatabase()
        .prepare("SELECT * FROM memories WHERE scope = 'global' AND status = 'active' ORDER BY updated_at DESC LIMIT 100")
        .all();
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ memories: rows, count: rows.length }, null, 2),
        }],
      };
    }
  );
}
