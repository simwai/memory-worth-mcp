import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MemorySynthesizeOutputSchema } from "../output-schemas.js";
import { getDatabase } from "../db/registry.js";
import { rowToMemory, MemoryRowLike } from "../utils/mappers.js";
import { logger } from "../utils/logger.js";

export function registerMemorySynthesize(server: McpServer): void {
  server.registerTool("memory_synthesize", {
    title: "Synthesize Memories",
    description: "Combine multiple memories into a synthesized answer for a question",
    inputSchema: { memoryIds: z.array(z.string()).min(1), project: z.string().min(1), question: z.string().min(1) },
    outputSchema: MemorySynthesizeOutputSchema,
  }, async (args, extra) => {
    const signal = extra.signal as AbortSignal | undefined;
    const db = getDatabase();
    const placeholders = args.memoryIds.map(() => "?").join(",");
    const rows = db.prepare(`SELECT * FROM memories WHERE id IN (${placeholders})`).all(...args.memoryIds) as MemoryRowLike[];

    if (rows.length === 0) {
      logger.warn("memory_synthesize", { memoryIds: args.memoryIds, result: "not_found" });
      return { isError: true, content: [{ type: "text", text: "No memories found for synthesis" }] };
    }

    const sources = [];
    for (let i = 0; i < rows.length; i++) {
      if (signal?.aborted) {
        logger.warn("memory_synthesize", { project: args.project, cancelled: true, progress: i, total: rows.length });
        throw new Error("Operation cancelled");
      }
      sources.push(rowToMemory(rows[i]));
      const extraWithProgress = extra as { sendProgress?: (update: { progress: number; total: number; message: string }) => Promise<void> };
      if (extraWithProgress.sendProgress) {
        await extraWithProgress.sendProgress({ progress: i + 1, total: rows.length, message: `Processed ${rows[i].id}` });
      }
    }

    const combinedInsights = rows.filter(r => r.trust_label === "high").map(r => r.content).join("\n---\n");
    const conflictingViews = rows.filter(r => r.trust_label === "low").map(r => r.content).join("\n---\n");

    const result = {
      question: args.question,
      sources,
      combinedInsights,
      conflictingViews,
      generatedAt: Date.now(),
    };
    logger.info("memory_synthesize", { project: args.project, sourceCount: sources.length });
    return {
      structuredContent: result,
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });
}