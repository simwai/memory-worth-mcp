import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MemorySynthesizeOutputSchema } from "../output-schemas.js";
import { getDatabase } from "../db/registry.js";

export function registerMemorySynthesize(server: McpServer): void {
  server.registerTool("memory_synthesize", {
    title: "Synthesize Memories",
    description: "Combine multiple memories into a synthesized answer for a question",
    inputSchema: { memoryIds: z.array(z.string()).min(1), project: z.string().min(1), question: z.string().min(1) },
    outputSchema: MemorySynthesizeOutputSchema,
  }, async (args) => {
    const db = getDatabase();
    const placeholders = args.memoryIds.map(() => "?").join(",");
    const rows = db.prepare(`SELECT * FROM memories WHERE id IN (${placeholders})`).all(...args.memoryIds) as any[];

    if (rows.length === 0) {
      return { isError: true, content: [{ type: "text", text: "No memories found for synthesis" }] };
    }

    const sources = rows.map(r => ({
      id: r.id,
      content: r.content,
      appliesWhen: r.applies_when,
      trustLabel: r.trust_label,
      evidenceRefs: JSON.parse(r.evidence_refs),
    }));
    const combinedInsights = rows.filter(r => r.trust_label === "high").map(r => r.content).join("\n---\n");
    const conflictingViews = rows.filter(r => r.trust_label === "low").map(r => r.content).join("\n---\n");

    const result = {
      question: args.question,
      sources,
      combinedInsights,
      conflictingViews,
      generatedAt: Date.now(),
    };
    return {
      structuredContent: result,
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });
}