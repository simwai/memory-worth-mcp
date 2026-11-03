import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { determineWriteScope } from "../routing/index.js";
import { calculateTrustScore } from "../trust/index.js";
import { MemoryMergeOutputSchema } from "../output-schemas.js";
import { getDatabase } from "../db/registry.js";

export function registerMemoryMerge(server: McpServer): void {
  server.registerTool("memory_merge", {
    title: "Merge Memories",
    description: "Merge multiple memories into a new one, superseding the originals",
    inputSchema: { memoryIds: z.array(z.string()).min(2), newContent: z.string().min(1), newAppliesWhen: z.string().min(1), project: z.string().min(1) },
    outputSchema: MemoryMergeOutputSchema,
  }, async (args) => {
    const db = getDatabase();
    const placeholders = args.memoryIds.map(() => "?").join(",");
    const memories = db.prepare(`SELECT * FROM memories WHERE id IN (${placeholders})`).all(...args.memoryIds) as any[];
    if (memories.length !== args.memoryIds.length) {
      return { isError: true, content: [{ type: "text", text: "One or more memories not found" }] };
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

    const result = { mergedId: id, superseded: args.memoryIds, scope, trustScore: score, trustLabel: label };
    return {
      structuredContent: result,
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });
}