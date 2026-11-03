import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import * as z from "zod";
import { determineWriteScope } from "../routing/index.js";
import { calculateTrustScore } from "../trust/index.js";

const MergeSchema = z.object({ memoryIds: z.array(z.string()).min(2), newContent: z.string().min(1), newAppliesWhen: z.string().min(1), project: z.string().min(1) });
type MergeArgs = z.infer<typeof MergeSchema>;

export function registerMemoryMerge(server: Server, db: DatabaseType): void {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "memory_merge") {
      return { content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }], isError: true };
    }

    const rawArgs = request.params.arguments as Record<string, unknown> | undefined;
    const parsed = MergeSchema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      return { content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }], isError: true };
    }
    const args = parsed.data as MergeArgs;

    const placeholders = args.memoryIds.map(() => "?").join(",");
    const memories = db.prepare(`SELECT * FROM memories WHERE id IN (${placeholders})`).all(...args.memoryIds) as any[];
    if (memories.length !== args.memoryIds.length) {
      return { content: [{ type: "text", text: "One or more memories not found" }], isError: true };
    }

    const scope = determineWriteScope(args.newContent, args.newAppliesWhen);
    const id = crypto.randomUUID();
    const now = Date.now();
    const { score, label } = calculateTrustScore(id, db);
    const allRefs = memories.flatMap(m => JSON.parse(m.evidence_refs));

    db.prepare(`INSERT INTO memories (id, project, scope, content, applies_when, tags, trust_score, trust_label, evidence_refs, created_at, updated_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, args.project, scope, args.newContent, args.newAppliesWhen, "[]", score, label, JSON.stringify(allRefs), now, now, "active");

    for (const oldId of args.memoryIds) {
      db.prepare("UPDATE memories SET status = 'superseded', superseded_by = ?, updated_at = ? WHERE id = ?").run(id, now, oldId);
    }

    return { content: [{ type: "text", text: JSON.stringify({ mergedId: id, superseded: args.memoryIds, scope, trustScore: score, trustLabel: label }, null, 2) }], isError: false };
  });
}