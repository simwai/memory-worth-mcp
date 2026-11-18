import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDatabase } from "../db/registry.js";
import { MemoryInvalidateOutputSchema } from "../output-schemas.js";

export function registerMemoryInvalidate(server: McpServer): void {
  server.registerTool(
    "memory_invalidate",
    {
      title: "Invalidate Memory",
      description: "Mark a memory as superseded by another with a reason",
      inputSchema: {
        id: z.string().min(1),
        supersededBy: z.string().min(1),
        reason: z.string().min(1),
      },
      outputSchema: MemoryInvalidateOutputSchema,
    },
    async (args) => {
      if (args.id === args.supersededBy) {
        return {
          isError: true,
          content: [{ type: "text", text: "A memory cannot supersede itself" }],
        };
      }

      const db = getDatabase();
      const existing = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.id);
      if (!existing) {
        return { isError: true, content: [{ type: "text", text: `Memory not found: ${args.id}` }] };
      }

      const superseding = db
        .prepare("SELECT * FROM memories WHERE id = ?")
        .get(args.supersededBy) as { evidence_refs: string } | undefined;
      if (!superseding) {
        return {
          isError: true,
          content: [{ type: "text", text: `Superseding memory not found: ${args.supersededBy}` }],
        };
      }

      db.transaction(() => {
        db.prepare(
          "UPDATE memories SET status = 'superseded', superseded_by = ?, updated_at = ? WHERE id = ?",
        ).run(args.supersededBy, Date.now(), args.id);
        let oldRefs: string[] = [];
        try {
          oldRefs = JSON.parse(superseding.evidence_refs as string);
          if (!Array.isArray(oldRefs)) oldRefs = [];
        } catch {
          oldRefs = [];
        }
        db.prepare("UPDATE memories SET evidence_refs = ?, updated_at = ? WHERE id = ?").run(
          JSON.stringify([...oldRefs, `invalidated:${args.id}:${args.reason}`]),
          Date.now(),
          args.supersededBy,
        );
      })();

      const result = { invalidated: args.id, supersededBy: args.supersededBy, reason: args.reason };
      return {
        structuredContent: result,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
