import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MemoryDeleteOutputSchema } from "../output-schemas.js";
import { getDatabase } from "../db/registry.js";

export function registerMemoryDelete(server: McpServer): void {
  server.registerTool("memory_delete", {
    title: "Delete Memory",
    description: "Soft delete (archive) or hard delete a memory",
    inputSchema: { id: z.string().min(1), hard: z.boolean().default(false) },
    outputSchema: MemoryDeleteOutputSchema,
  }, async (args) => {
    const db = getDatabase();
    const existing = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.id);
    if (!existing) {
      return { isError: true, content: [{ type: "text", text: `Memory not found: ${args.id}` }] };
    }

    if (args.hard) {
      db.prepare("DELETE FROM memories WHERE id = ?").run(args.id);
      db.prepare("DELETE FROM trust_calibration WHERE memory_id = ?").run(args.id);
      const result = { id: args.id, action: "deleted" as const };
      return { structuredContent: result, content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } else {
      db.prepare("UPDATE memories SET status = 'archived', updated_at = ? WHERE id = ?").run(Date.now(), args.id);
      const result = { id: args.id, action: "archived" as const };
      return { structuredContent: result, content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  });
}