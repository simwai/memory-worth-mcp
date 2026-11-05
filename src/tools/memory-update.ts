import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MemoryUpdateOutputSchema } from "../output-schemas.js";
import { getDatabase } from "../db/registry.js";
import { rowToMemory, MemoryRowLike } from "../utils/mappers.js";
import { logger } from "../utils/logger.js";

export function registerMemoryUpdate(server: McpServer): void {
  server.registerTool("memory_update", {
    title: "Update Memory",
    description: "Update an existing memory's content, trust score, tags, or status",
    inputSchema: {
      id: z.string().min(1),
      content: z.string().optional(),
      appliesWhen: z.string().optional(),
      tags: z.array(z.string()).optional(),
      trustScore: z.number().min(0).max(1).optional(),
      status: z.enum(["active", "archived", "superseded"]).optional(),
      supersededBy: z.string().optional(),
    },
    outputSchema: MemoryUpdateOutputSchema,
  }, async (args) => {
    const db = getDatabase();
    const existing = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.id) as MemoryRowLike | undefined;
    if (!existing) {
      logger.warn("memory_update", { id: args.id, result: "not_found" });
      return { isError: true, content: [{ type: "text", text: `Memory not found: ${args.id}` }] };
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (args.content !== undefined) { updates.push("content = ?"); params.push(args.content); }
    if (args.appliesWhen !== undefined) { updates.push("applies_when = ?"); params.push(args.appliesWhen); }
    if (args.tags !== undefined) { updates.push("tags = ?"); params.push(JSON.stringify(args.tags)); }
    if (args.trustScore !== undefined) {
      updates.push("trust_score = ?"); params.push(args.trustScore);
      let label: "high" | "low" | "unproven";
      if (args.trustScore >= 0.7) label = "high";
      else if (args.trustScore <= 0.3) label = "low";
      else label = "unproven";
      updates.push("trust_label = ?"); params.push(label);
    }
    if (args.status !== undefined) { updates.push("status = ?"); params.push(args.status); }
    if (args.supersededBy !== undefined) { updates.push("superseded_by = ?"); params.push(args.supersededBy); }

    if (updates.length === 0) {
      return { isError: true, content: [{ type: "text", text: "No updates provided" }] };
    }

    updates.push("updated_at = ?"); params.push(Date.now()); params.push(args.id);
    db.prepare(`UPDATE memories SET ${updates.join(", ")} WHERE id = ?`).run(...params);

    const updated = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.id) as MemoryRowLike;
    const memory = rowToMemory(updated);
    logger.info("memory_update", { id: args.id, fields: Object.keys(args).filter(k => k !== "id") });
    return {
      structuredContent: { memory },
      content: [{ type: "text", text: JSON.stringify({ memory }, null, 2) }],
    };
  });
}