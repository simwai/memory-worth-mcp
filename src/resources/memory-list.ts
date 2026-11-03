import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../db/registry.js";
import { rowToMemory, MemoryRowLike } from "../utils/mappers.js";

export function registerMemoryListResource(server: McpServer): void {
  server.registerResource(
    "memory-list",
    new ResourceTemplate("memory://project/{project}/memories", {
      list: async () => {
        const projects = getDatabase()
          .prepare("SELECT DISTINCT project FROM memories")
          .all() as { project: string }[];
        return {
          resources: projects.map(({ project }) => ({
            uri: `memory://project/${project}/memories`,
            name: `project-memories-${project}`,
            title: `Active memories -- ${project}`,
            description: `JSON list of active memories for project ${project}`,
            mimeType: "application/json",
          })),
        };
      },
    }),
    {
      title: "Project Memories List",
      description: "Active memories for a project as a JSON list (most recently updated first, capped at 100)",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const rows = getDatabase()
        .prepare("SELECT * FROM memories WHERE project = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 100")
        .all(variables.project) as MemoryRowLike[];
      const memories = rows.map(rowToMemory);
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ memories, count: memories.length }, null, 2),
        }],
      };
    }
  );
}
