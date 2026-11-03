import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import * as z from "zod";

const GetSchema = z.object({
  id: z.string().min(1),
});

type GetArgs = z.infer<typeof GetSchema>;

export function registerMemoryGet(server: Server, db: DatabaseType): void {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "memory_get") {
      return { content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }], isError: true };
    }

    const rawArgs = request.params.arguments as Record<string, unknown> | undefined;
    const parsed = GetSchema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      return { content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }], isError: true };
    }
    const args = parsed.data as GetArgs;

    const row = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.id);

    if (!row) {
      return { content: [{ type: "text", text: `Memory not found: ${args.id}` }], isError: true };
    }

    return { content: [{ type: "text", text: JSON.stringify(row, null, 2) }], isError: false };
  });
}