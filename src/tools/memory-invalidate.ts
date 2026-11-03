import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import * as z from "zod";

const InvalidateSchema = z.object({ id: z.string().min(1), supersededBy: z.string().min(1), reason: z.string().min(1) });
type InvalidateArgs = z.infer<typeof InvalidateSchema>;

export function registerMemoryInvalidate(server: Server, db: DatabaseType): void {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "memory_invalidate") {
      return { content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }], isError: true };
    }

    const rawArgs = request.params.arguments as Record<string, unknown> | undefined;
    const parsed = InvalidateSchema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      return { content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }], isError: true };
    }
    const args = parsed.data as InvalidateArgs;

    const existing = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.id) as any;
    if (!existing) return { content: [{ type: "text", text: `Memory not found: ${args.id}` }], isError: true };

    const superseding = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.supersededBy) as any;
    if (!superseding) return { content: [{ type: "text", text: `Superseding memory not found: ${args.supersededBy}` }], isError: true };

    db.prepare("UPDATE memories SET status = 'superseded', superseded_by = ?, updated_at = ? WHERE id = ?").run(args.supersededBy, Date.now(), args.id);
    const oldRefs = JSON.parse(superseding.evidence_refs);
    db.prepare("UPDATE memories SET evidence_refs = ?, updated_at = ? WHERE id = ?").run(JSON.stringify([...oldRefs, `invalidated:${args.id}:${args.reason}`]), Date.now(), args.supersededBy);

    return { content: [{ type: "text", text: JSON.stringify({ invalidated: args.id, supersededBy: args.supersededBy, reason: args.reason }, null, 2) }], isError: false };
  });
}