import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveScope, buildOrderByClause } from "../routing/index.js";
import { MemorySearchOutputSchema } from "../output-schemas.js";
import { getDatabase } from "../db/registry.js";
import { rowToMemory, MemoryRowLike } from "../utils/mappers.js";

export function registerMemorySearch(server: McpServer): void {
  server.registerTool("memory_search", {
    title: "Search Memories",
    description: "Search memories by query, scope, trust level, and tags",
    inputSchema: {
      query: z.string().min(1),
      scope: z.enum(["auto", "project", "global", "all"]).default("auto"),
      project: z.string().optional(),
      limit: z.number().int().positive().max(100).default(10),
      minTrust: z.number().min(0).max(1).optional(),
      tags: z.array(z.string()).optional(),
    },
    outputSchema: MemorySearchOutputSchema,
  }, async (args) => {
    const db = getDatabase();
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

    const rows = db.prepare(sql).all(...params) as MemoryRowLike[];
    const memories = rows.map(rowToMemory);

    return {
      structuredContent: { memories, count: memories.length },
      content: [{ type: "text", text: JSON.stringify({ memories, count: memories.length }, null, 2) }],
    };
  });
}
