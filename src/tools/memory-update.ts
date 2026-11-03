import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import * as z from "zod";

const UpdateSchema = z.object({
  id: z.string().min(1),
  content: z.string().optional(),
  appliesWhen: z.string().optional(),
  tags: z.array(z.string()).optional(),
  trustScore: z.number().min(0).max(1).optional(),
  status: z.enum(["active", "archived", "superseded"]).optional(),
  supersededBy: z.string().optional(),
});

type UpdateArgs = z.infer<typeof UpdateSchema>;

export function registerMemoryUpdate(server: Server, db: DatabaseType): void {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "memory_update") {
      return { content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }], isError: true };
    }

    const rawArgs = request.params.arguments as Record<string, unknown> | undefined;
    const parsed = UpdateSchema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      return { content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }], isError: true };
    }
    const args = parsed.data as UpdateArgs;

    const existing = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.id);
    if (!existing) {
      return { content: [{ type: "text", text: `Memory not found: ${args.id}` }], isError: true };
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
      return { content: [{ type: "text", text: "No updates provided" }], isError: true };
    }

    updates.push("updated_at = ?"); params.push(Date.now()); params.push(args.id);
    db.prepare(`UPDATE memories SET ${updates.join(", ")} WHERE id = ?`).run(...params);

    const updated = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.id);
    return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }], isError: false };
  });
}