import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../db/registry.js";
import { type MemoryRowLike, rowToMemory } from "../utils/mappers.js";

export function registerMemoryGlobalResource(server: McpServer): void {
  server.registerResource(
    "memory-global",
    "memory://global/memories",
    {
      title: "Global Memories",
      description:
        "Active global-scope memories as a JSON list (most recently updated first, capped at 100)",
      mimeType: "application/json",
    },
    async (uri) => {
      const rows = getDatabase()
        .prepare(
          "SELECT * FROM memories WHERE scope = 'global' AND status = 'active' ORDER BY updated_at DESC LIMIT 100",
        )
        .all() as MemoryRowLike[];
      const memories = rows.map(rowToMemory);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ memories, count: memories.length }, null, 2),
          },
        ],
      };
    },
  );
}
