import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPopulationQuantiles } from "../trust/index.js";
import { MemoryTuneOutputSchema } from "../output-schemas.js";
import { getDatabase } from "../db/registry.js";
import { logger } from "../utils/logger.js";

export function registerMemoryTune(server: McpServer): void {
  server.registerTool("memory_tune", {
    title: "Tune Memory",
    description: "Adjust trust score thresholds and relabel memories",
    inputSchema: { project: z.string().optional(), highThreshold: z.number().min(0).max(1).optional(), lowThreshold: z.number().min(0).max(1).optional() },
    outputSchema: MemoryTuneOutputSchema,
  }, async (args, extra) => {
    const signal = extra.signal as AbortSignal | undefined;
    const db = getDatabase();
    const project = args.project || process.env.MEMORY_WORTH_PROJECT || "default";
    const quantiles = getPopulationQuantiles(db);
    const currentHigh = args.highThreshold ?? quantiles.high;
    const currentLow = args.lowThreshold ?? quantiles.low;
    logger.debug("memory_tune", { project, highThreshold: currentHigh, lowThreshold: currentLow });

    const memories = db.prepare(`SELECT id, trust_score FROM memories WHERE project = ? AND status = 'active'`).all(project) as { id: string; trust_score: number }[];
    const total = memories.length;

    for (let i = 0; i < memories.length; i++) {
      if (signal?.aborted) {
        logger.warn("memory_tune", { project, cancelled: true, progress: i, total });
        throw new Error("Operation cancelled");
      }
      const m = memories[i];
      let label: "high" | "low" | "unproven";
      if (m.trust_score >= currentHigh) label = "high";
      else if (m.trust_score <= currentLow) label = "low";
      else label = "unproven";
      db.prepare("UPDATE memories SET trust_label = ?, updated_at = ? WHERE id = ?").run(label, Date.now(), m.id);
      const extraWithProgress = extra as { sendProgress?: (update: { progress: number; total: number; message: string }) => Promise<void> };
      if (extraWithProgress.sendProgress) {
        await extraWithProgress.sendProgress({ progress: i + 1, total, message: `Relabeled ${m.id} → ${label}` });
      }
    }

    const result = {
      project,
      previousQuantiles: quantiles,
      newThresholds: { high: currentHigh, low: currentLow },
      relabeledCount: memories.length,
    };
    logger.info("memory_tune", { project, relabeledCount: memories.length });
    return {
      structuredContent: result,
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });
}