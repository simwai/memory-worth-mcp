import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import * as z from "zod";

const SynthesizeSchema = z.object({
  memoryIds: z.array(z.string()).min(1),
  project: z.string().min(1),
  question: z.string().min(1),
});

type SynthesizeArgs = z.infer<typeof SynthesizeSchema>;

export function registerMemorySynthesize(server: Server, db: DatabaseType): void {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "memory_synthesize") {
      return { content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }], isError: true };
    }

    const rawArgs = request.params.arguments as Record<string, unknown> | undefined;
    const parsed = SynthesizeSchema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      return { content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }], isError: true };
    }
    const args = parsed.data as SynthesizeArgs;

    const placeholders = args.memoryIds.map(() => "?").join(",");
    const rows = db.prepare(`SELECT * FROM memories WHERE id IN (${placeholders})`).all(...args.memoryIds) as any[];

    if (rows.length === 0) {
      return { content: [{ type: "text", text: "No memories found for synthesis" }], isError: true };
    }

    const synthesis = {
      question: args.question,
      sources: rows.map(r => ({
        id: r.id, content: r.content, appliesWhen: r.applies_when,
        trustLabel: r.trust_label, evidenceRefs: JSON.parse(r.evidence_refs),
      })),
      combinedInsights: rows.filter(r => r.trust_label === "high").map(r => r.content).join("\n---\n"),
      conflictingViews: rows.filter(r => r.trust_label === "low").map(r => r.content).join("\n---\n"),
      generatedAt: Date.now(),
    };

    return { content: [{ type: "text", text: JSON.stringify(synthesis, null, 2) }], isError: false };
  });
}