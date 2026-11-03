import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import * as z from "zod";
import { getPopulationQuantiles } from "../trust/index.js";

const TuneSchema = z.object({ project: z.string().optional(), highThreshold: z.number().min(0).max(1).optional(), lowThreshold: z.number().min(0).max(1).optional() });
type TuneArgs = z.infer<typeof TuneSchema>;

export function registerMemoryTune(server: Server, db: DatabaseType): void {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "memory_tune") {
      return { content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }], isError: true };
    }

    const rawArgs = request.params.arguments as Record<string, unknown> | undefined;
    const parsed = TuneSchema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      return { content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }], isError: true };
    }
    const args = parsed.data as TuneArgs;
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

    return { content: [{ type: "text", text: JSON.stringify({ project, previousQuantiles: quantiles, newThresholds: { high: currentHigh, low: currentLow }, relabeledCount: memories.length }, null, 2) }], isError: false };
  });
}