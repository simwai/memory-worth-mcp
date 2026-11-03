import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MemoryWakeupOutputSchema } from "../output-schemas.js";
import { getDatabase } from "../db/registry.js";

export function registerMemoryWakeup(server: McpServer): void {
  server.registerTool("memory_wakeup", {
    title: "Wakeup Memory",
    description: "Session-start digest with high-trust memories, recent activity, and protocol reminder",
    inputSchema: { project: z.string().min(1), sessionId: z.string().min(1) },
    outputSchema: MemoryWakeupOutputSchema,
  }, async (args) => {
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO sessions (id, project, started_at, last_active_at, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(args.sessionId, args.project, Date.now(), Date.now(), "{}");

    const highTrust = db.prepare(`
      SELECT * FROM memories WHERE project = ? AND trust_label = 'high' AND status = 'active'
      ORDER BY trust_score DESC, updated_at DESC LIMIT 5
    `).all(args.project) as any[];

    const recent = db.prepare(`
      SELECT * FROM memories WHERE project = ? AND status = 'active'
      ORDER BY updated_at DESC LIMIT 10
    `).all(args.project) as any[];

    const needsReview = db.prepare(`
      SELECT * FROM memories WHERE project = ? AND trust_label = 'unproven' AND status = 'active'
      ORDER BY created_at DESC LIMIT 5
    `).all(args.project) as any[];

    const result = {
      sessionId: args.sessionId,
      project: args.project,
      timestamp: Date.now(),
      highTrustMemories: highTrust.map(r => ({ id: r.id, summary: r.content.slice(0, 200), appliesWhen: r.applies_when, trustScore: r.trust_score })),
      recentActivity: recent.map(r => ({ id: r.id, summary: r.content.slice(0, 150), updatedAt: r.updated_at })),
      needsReview: needsReview.map(r => ({ id: r.id, summary: r.content.slice(0, 150), appliesWhen: r.applies_when })),
      protocolReminder: "Remember: search memory before answering; write grounded insights; trust labels are population quantiles (high=co-occurred with success, low=co-occurred with failure, unproven=too little evidence).",
    };
    return {
      structuredContent: result,
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });
}