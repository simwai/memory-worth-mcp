import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import * as z from "zod";

const DeleteSchema = z.object({
  id: z.string().min(1),
  hard: z.boolean().default(false),
});

type DeleteArgs = z.infer<typeof DeleteSchema>;

export function registerMemoryDelete(server: Server, db: DatabaseType): void {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "memory_delete") {
      return { content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }], isError: true };
    }

    const rawArgs = request.params.arguments as Record<string, unknown> | undefined;
    const parsed = DeleteSchema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      return { content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }], isError: true };
    }
    const args = parsed.data as DeleteArgs;

    const existing = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.id);
    if (!existing) {
      return { content: [{ type: "text", text: `Memory not found: ${args.id}` }], isError: true };
    }

    if (args.hard) {
      db.prepare("DELETE FROM memories WHERE id = ?").run(args.id);
      db.prepare("DELETE FROM trust_calibration WHERE memory_id = ?").run(args.id);
      return { content: [{ type: "text", text: `Memory permanently deleted: ${args.id}` }], isError: false };
    } else {
      db.prepare("UPDATE memories SET status = 'archived', updated_at = ? WHERE id = ?").run(Date.now(), args.id);
      return { content: [{ type: "text", text: `Memory archived: ${args.id}` }], isError: false };
    }
  });
}