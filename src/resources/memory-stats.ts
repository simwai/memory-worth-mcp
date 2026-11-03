import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../db/registry.js";

export function registerMemoryStatsResource(server: McpServer): void {
  server.registerResource(
    "memory-stats",
    new ResourceTemplate("memory://project/{project}/stats", {
      list: undefined,
    }),
    {
      title: "Project Statistics",
      description: "Statistics summary for a project as a JSON document",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const db = getDatabase();
      const project = variables.project;

      const projectStats = db.prepare(`
        SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status='archived' THEN 1 ELSE 0 END) as archived,
          SUM(CASE WHEN status='superseded' THEN 1 ELSE 0 END) as superseded,
          SUM(CASE WHEN trust_label='high' THEN 1 ELSE 0 END) as high_trust,
          SUM(CASE WHEN trust_label='low' THEN 1 ELSE 0 END) as low_trust,
          SUM(CASE WHEN trust_label='unproven' THEN 1 ELSE 0 END) as unproven,
          AVG(trust_score) as avg_trust FROM memories WHERE project = ?
      `).get(project);

      const globalStats = db.prepare(`
        SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN trust_label='high' THEN 1 ELSE 0 END) as high_trust, AVG(trust_score) as avg_trust
        FROM memories WHERE scope = 'global'
      `).get();

      const tagCounts = db.prepare(`
        SELECT json_each.value as tag, COUNT(*) as count FROM memories, json_each(tags)
        WHERE project = ? AND status = 'active' GROUP BY json_each.value ORDER BY count DESC LIMIT 20
      `).all(project);

      const result = {
        project,
        projectStats,
        globalStats,
        topTags: tagCounts,
      };

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );
}
