import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import * as z from "zod";
import { determineWriteScope } from "../routing/index.js";
import { calculateTrustScore } from "../trust/index.js";

const WriteSchema = z.object({
  project: z.string().min(1),
  content: z.string().min(1),
  appliesWhen: z.string().min(1),
  tags: z.array(z.string()).optional(),
  scope: z.enum(["project", "global"]).optional(),
  sessionId: z.string().optional(),
});

type WriteArgs = z.infer<typeof WriteSchema>;

export function registerMemoryWrite(server: Server, db: DatabaseType): void {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "memory_write") {
      return { content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }], isError: true };
    }

    const rawArgs = request.params.arguments as Record<string, unknown> | undefined;
    const parsed = WriteSchema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      return { content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }], isError: true };
    }
    const args = parsed.data as WriteArgs;

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

    return { content: [{ type: "text", text: JSON.stringify({ id, scope, trustScore: score, trustLabel: label }, null, 2) }], isError: false };
  });
}