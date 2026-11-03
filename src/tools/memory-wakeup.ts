import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import * as z from "zod";

const WakeupSchema = z.object({
  project: z.string().min(1),
  sessionId: z.string().min(1),
});

type WakeupArgs = z.infer<typeof WakeupSchema>;

export function registerMemoryWakeup(server: Server, db: DatabaseType): void {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "memory_wakeup") {
      return { content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }], isError: true };
    }

    const rawArgs = request.params.arguments as Record<string, unknown> | undefined;
    const parsed = WakeupSchema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      return { content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }], isError: true };
    }
    const args = parsed.data as WakeupArgs;

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

    const digest = {
      sessionId: args.sessionId, project: args.project, timestamp: Date.now(),
      highTrustMemories: highTrust.map(r => ({ id: r.id, summary: r.content.slice(0, 200), appliesWhen: r.applies_when, trustScore: r.trust_score })),
      recentActivity: recent.map(r => ({ id: r.id, summary: r.content.slice(0, 150), updatedAt: r.updated_at })),
      needsReview: needsReview.map(r => ({ id: r.id, summary: r.content.slice(0, 150), appliesWhen: r.applies_when })),
      protocolReminder: "Remember: search memory before answering; write grounded insights; trust labels are population quantiles (high=co-occurred with success, low=co-occurred with failure, unproven=too little evidence).",
    };

    return { content: [{ type: "text", text: JSON.stringify(digest, null, 2) }], isError: false };
  });
}