import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MemoryStatsOutputSchema } from "../output-schemas.js";
import { getDatabase } from "../db/registry.js";

interface ProjectStatsRow {
  total: number;
  active: number;
  archived: number;
  superseded: number;
  high_trust: number;
  low_trust: number;
  unproven: number;
  avg_trust: number | null;
}

interface GlobalStatsRow {
  total: number;
  active: number;
  high_trust: number;
  avg_trust: number | null;
}

interface TagCountRow {
  tag: string;
  count: number;
}

export function registerMemoryStats(server: McpServer): void {
  server.registerTool("memory_stats", {
    title: "Memory Stats",
    description: "Project and global memory statistics with trust distribution and top tags",
    inputSchema: { project: z.string().optional() },
    outputSchema: MemoryStatsOutputSchema,
  }, async (args) => {
    const db = getDatabase();
    const project = args.project || process.env.MEMORY_WORTH_PROJECT || "default";

    const projectStats = db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status='archived' THEN 1 ELSE 0 END) as archived,
        SUM(CASE WHEN status='superseded' THEN 1 ELSE 0 END) as superseded,
        SUM(CASE WHEN trust_label='high' THEN 1 ELSE 0 END) as high_trust,
        SUM(CASE WHEN trust_label='low' THEN 1 ELSE 0 END) as low_trust,
        SUM(CASE WHEN trust_label='unproven' THEN 1 ELSE 0 END) as unproven,
        AVG(trust_score) as avg_trust FROM memories WHERE project = ?
    `).get(project) as ProjectStatsRow;

    const globalStats = db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN trust_label='high' THEN 1 ELSE 0 END) as high_trust, AVG(trust_score) as avg_trust
      FROM memories WHERE scope = 'global'
    `).get() as GlobalStatsRow;

    const tagCounts = db.prepare(`
      SELECT json_each.value as tag, COUNT(*) as count FROM memories, json_each(tags)
      WHERE project = ? AND status = 'active' GROUP BY json_each.value ORDER BY count DESC LIMIT 20
    `).all(project) as TagCountRow[];

    const result = {
      project,
      projectStats: {
        total: projectStats.total,
        active: projectStats.active,
        archived: projectStats.archived,
        superseded: projectStats.superseded,
        highTrust: projectStats.high_trust,
        lowTrust: projectStats.low_trust,
        unproven: projectStats.unproven,
        avgTrust: projectStats.avg_trust,
      },
      globalStats: {
        total: globalStats.total,
        active: globalStats.active,
        highTrust: globalStats.high_trust,
        avgTrust: globalStats.avg_trust,
      },
      topTags: tagCounts.map(t => ({ tag: t.tag, count: t.count })),
    };
    return {
      structuredContent: result,
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });
}