import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import * as z from "zod";

const SetStatusSchema = z.object({ id: z.string().min(1), status: z.enum(["active", "archived", "superseded"]) });
type SetStatusArgs = z.infer<typeof SetStatusSchema>;

export function registerMemorySetStatus(server: Server, db: DatabaseType): void {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "memory_set_status") {
      return { content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }], isError: true };
    }

    const rawArgs = request.params.arguments as Record<string, unknown> | undefined;
    const parsed = SetStatusSchema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      return { content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }], isError: true };
    }
    const args = parsed.data as SetStatusArgs;

    const existing = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.id);
    if (!existing) return { content: [{ type: "text", text: `Memory not found: ${args.id}` }], isError: true };

    db.prepare("UPDATE memories SET status = ?, updated_at = ? WHERE id = ?").run(args.status, Date.now(), args.id);
    return { content: [{ type: "text", text: JSON.stringify({ id: args.id, status: args.status }, null, 2) }], isError: false };
  });
}