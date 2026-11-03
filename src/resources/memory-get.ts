import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getDatabase } from "../db/registry.js";

export function registerMemoryGetResource(server: McpServer): void {
  server.registerResource(
    "memory-get",
    new ResourceTemplate("memory://project/{project}/memories/{id}", {
      list: undefined,
    }),
    {
      title: "Single Memory",
      description: "A single memory as a JSON document",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const row = getDatabase()
        .prepare("SELECT * FROM memories WHERE id = ? AND project = ?")
        .get(variables.id, variables.project);
      if (!row) {
        throw new McpError(ErrorCode.InvalidParams, `Memory not found: ${variables.id} (project: ${variables.project})`);
      }
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(row, null, 2),
        }],
      };
    }
  );
}
