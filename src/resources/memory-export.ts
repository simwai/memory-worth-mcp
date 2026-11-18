import { type McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../db/registry.js";
import { type MemoryRowLike, rowToMemory } from "../utils/mappers.js";

export function registerMemoryExportResource(server: McpServer): void {
  server.registerResource(
    "memory-export",
    new ResourceTemplate("memory://project/{project}/export", {
      list: undefined,
    }),
    {
      title: "Project Memory Export",
      description: "Full JSON export of all active memories for a project",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const rows = getDatabase()
        .prepare(
          "SELECT * FROM memories WHERE project = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1000",
        )
        .all(variables.project) as MemoryRowLike[];
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(rows.map(rowToMemory), null, 2),
          },
        ],
      };
    },
  );
}
