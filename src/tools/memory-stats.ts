import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import * as z from "zod";

const StatsSchema = z.object({ project: z.string().optional() });
type StatsArgs = z.infer<typeof StatsSchema>;

export function registerMemoryStats(server: Server, db: DatabaseType): void {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "memory_stats") {
      return { content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }], isError: true };
    }

    const rawArgs = request.params.arguments as Record<string, unknown> | undefined;
    const parsed = StatsSchema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      return { content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }], isError: true };
    }
    const args = parsed.data as StatsArgs;
    const project = args.project || process.env.MEMORY_WORTH_PROJECT || "default";

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

    return { content: [{ type: "text", text: JSON.stringify({ project, projectStats, globalStats, topTags: tagCounts }, null, 2) }], isError: false };
  });
}