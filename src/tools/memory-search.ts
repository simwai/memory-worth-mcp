import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import * as z from "zod";
import { resolveScope, buildOrderByClause } from "../routing/index.js";

const SearchSchema = z.object({
  query: z.string().min(1),
  scope: z.enum(["auto", "project", "global", "all"]).default("auto"),
  project: z.string().optional(),
  limit: z.number().int().positive().max(100).default(10),
  minTrust: z.number().min(0).max(1).optional(),
  tags: z.array(z.string()).optional(),
});

type SearchArgs = z.infer<typeof SearchSchema>;

export function registerMemorySearch(server: Server, db: DatabaseType): void {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "memory_search") {
      return {
        content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      };
    }

    const rawArgs = request.params.arguments as Record<string, unknown> | undefined;
    const parsed = SearchSchema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      return {
        content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }],
        isError: true,
      };
    }
    const args = parsed.data as SearchArgs;
    const project = args.project || process.env.MEMORY_WORTH_PROJECT || "default";

    const { whereClause, params } = resolveScope(args.scope, project);
    let fullWhere = whereClause;

    if (args.minTrust !== undefined) {
      fullWhere += (whereClause ? " AND" : " WHERE") + " trust_score >= ?";
      params.push(args.minTrust);
    }

    if (args.tags?.length) {
      const tagConditions = args.tags.map(() =>
        "EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)"
      ).join(" AND ");
      fullWhere += (whereClause ? " AND" : " WHERE") + ` (${tagConditions})`;
      params.push(...args.tags);
    }

    fullWhere += (whereClause ? " AND" : " WHERE") + " (content LIKE ? OR applies_when LIKE ?)";
    const searchTerm = `%${args.query}%`;
    params.push(searchTerm, searchTerm);

    const orderBy = buildOrderByClause(args.scope, project);
    const sql = `SELECT * FROM memories ${fullWhere} ${orderBy} LIMIT ?`;
    params.push(args.limit);

    const rows = db.prepare(sql).all(...params);

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      isError: false,
    };
  });
}