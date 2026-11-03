import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPopulationQuantiles } from "../trust/index.js";
import { MemoryTuneOutputSchema } from "../output-schemas.js";
import { getDatabase } from "../db/registry.js";

export function registerMemoryTune(server: McpServer): void {
  server.registerTool("memory_tune", {
    title: "Tune Memory",
    description: "Adjust trust score thresholds and relabel memories",
    inputSchema: { project: z.string().optional(), highThreshold: z.number().min(0).max(1).optional(), lowThreshold: z.number().min(0).max(1).optional() },
    outputSchema: MemoryTuneOutputSchema,
  }, async (args) => {
    const db = getDatabase();
    const project = args.project || process.env.MEMORY_WORTH_PROJECT || "default";
    const quantiles = getPopulationQuantiles(db);
    const currentHigh = args.highThreshold ?? quantiles.high;
    const currentLow = args.lowThreshold ?? quantiles.low;

    const memories = db.prepare(`SELECT id, trust_score FROM memories WHERE project = ? AND status = 'active'`).all(project) as { id: string; trust_score: number }[];

    for (const m of memories) {
      let label: "high" | "low" | "unproven";
      if (m.trust_score >= currentHigh) label = "high";
      else if (m.trust_score <= currentLow) label = "low";
      else label = "unproven";
      db.prepare("UPDATE memories SET trust_label = ?, updated_at = ? WHERE id = ?").run(label, Date.now(), m.id);
    }

    const result = {
      project,
      previousQuantiles: quantiles,
      newThresholds: { high: currentHigh, low: currentLow },
      relabeledCount: memories.length,
    };
    return {
      structuredContent: result,
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });
}