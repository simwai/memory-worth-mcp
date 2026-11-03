import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MemorySetStatusOutputSchema } from "../output-schemas.js";
import { getDatabase } from "../db/registry.js";

export function registerMemorySetStatus(server: McpServer): void {
  server.registerTool("memory_set_status", {
    title: "Set Memory Status",
    description: "Change a memory's status (active/archived/superseded)",
    inputSchema: { id: z.string().min(1), status: z.enum(["active", "archived", "superseded"]) },
    outputSchema: MemorySetStatusOutputSchema,
  }, async (args) => {
    const db = getDatabase();
    const existing = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.id);
    if (!existing) {
      return { isError: true, content: [{ type: "text", text: `Memory not found: ${args.id}` }] };
    }

    db.prepare("UPDATE memories SET status = ?, updated_at = ? WHERE id = ?").run(args.status, Date.now(), args.id);

    const result = { id: args.id, status: args.status };
    return {
      structuredContent: result,
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });
}