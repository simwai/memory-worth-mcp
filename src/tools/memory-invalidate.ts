import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MemoryInvalidateOutputSchema } from "../output-schemas.js";
import { getDatabase } from "../db/registry.js";

export function registerMemoryInvalidate(server: McpServer): void {
  server.registerTool("memory_invalidate", {
    title: "Invalidate Memory",
    description: "Mark a memory as superseded by another with a reason",
    inputSchema: { id: z.string().min(1), supersededBy: z.string().min(1), reason: z.string().min(1) },
    outputSchema: MemoryInvalidateOutputSchema,
  }, async (args) => {
    const db = getDatabase();
    const existing = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.id) as any;
    if (!existing) {
      return { isError: true, content: [{ type: "text", text: `Memory not found: ${args.id}` }] };
    }

    const superseding = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.supersededBy) as any;
    if (!superseding) {
      return { isError: true, content: [{ type: "text", text: `Superseding memory not found: ${args.supersededBy}` }] };
    }

    db.prepare("UPDATE memories SET status = 'superseded', superseded_by = ?, updated_at = ? WHERE id = ?").run(args.supersededBy, Date.now(), args.id);
    const oldRefs = JSON.parse(superseding.evidence_refs);
    db.prepare("UPDATE memories SET evidence_refs = ?, updated_at = ? WHERE id = ?").run(JSON.stringify([...oldRefs, `invalidated:${args.id}:${args.reason}`]), Date.now(), args.supersededBy);

    const result = { invalidated: args.id, supersededBy: args.supersededBy, reason: args.reason };
    return {
      structuredContent: result,
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });
}