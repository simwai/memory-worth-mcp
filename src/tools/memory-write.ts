import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { determineWriteScope } from "../routing/index.js";
import { calculateTrustScore } from "../trust/index.js";
import { MemoryWriteOutputSchema } from "../output-schemas.js";
import { getDatabase } from "../db/registry.js";
import { logger } from "../utils/logger.js";

export function registerMemoryWrite(server: McpServer): void {
  server.registerTool("memory_write", {
    title: "Write Memory",
    description: "Create a new memory (requires applies_when)",
    inputSchema: {
      project: z.string().min(1),
      content: z.string().min(1),
      appliesWhen: z.string().min(1),
      tags: z.array(z.string()).optional(),
      scope: z.enum(["project", "global"]).optional(),
      sessionId: z.string().optional(),
    },
    outputSchema: MemoryWriteOutputSchema,
  }, async (args) => {
    const db = getDatabase();
    const scope = args.scope || determineWriteScope(args.content, args.appliesWhen);
    const id = crypto.randomUUID();
    const now = Date.now();
    const { score, label } = calculateTrustScore(id, db);

    db.prepare(`
      INSERT INTO memories (id, project, scope, content, applies_when, tags, trust_score, trust_label, evidence_refs, created_at, updated_at, status, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, args.project, scope, args.content, args.appliesWhen,
      JSON.stringify(args.tags || []), score, label, "[]", now, now, "active", args.sessionId || null
    );

    const result = { id, scope, trustScore: score, trustLabel: label };
    logger.info("memory_write", { project: args.project, id, scope, trustLabel: label });
    return {
      structuredContent: result,
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });
}