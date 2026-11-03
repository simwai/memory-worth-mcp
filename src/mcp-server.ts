import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { initializeDatabase } from "./db/index.js";
import { calculateTrustScore, recordCalibration, getPopulationQuantiles } from "./trust/index.js";
import { resolveScope, buildOrderByClause, determineWriteScope } from "./routing/index.js";

async function main() {
  const db = initializeDatabase();

  const server = new McpServer(
    { name: "memory-worth-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // memory_search
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
  }, async (args, _extra) => {
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
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  });

  // memory_get
  server.registerTool("memory_get", {
    title: "Get Memory",
    description: "Retrieve a single memory by ID",
    inputSchema: { id: z.string().min(1) },
  }, async (args) => {
    const row = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.id);
    if (!row) return { content: [{ type: "text", text: `Memory not found: ${args.id}` }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(row, null, 2) }] };
  });

  // memory_write
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
  }, async (args) => {
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

    return { content: [{ type: "text", text: JSON.stringify({ id, scope, trustScore: score, trustLabel: label }, null, 2) }] };
  });

  // memory_update
  server.registerTool("memory_update", {
    title: "Update Memory",
    description: "Update an existing memory's content, trust score, tags, or status",
    inputSchema: {
      id: z.string().min(1),
      content: z.string().optional(),
      appliesWhen: z.string().optional(),
      tags: z.array(z.string()).optional(),
      trustScore: z.number().min(0).max(1).optional(),
      status: z.enum(["active", "archived", "superseded"]).optional(),
      supersededBy: z.string().optional(),
    },
  }, async (args) => {
    const existing = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.id);
    if (!existing) return { content: [{ type: "text", text: `Memory not found: ${args.id}` }], isError: true };

    const updates: string[] = [];
    const params: any[] = [];

    if (args.content !== undefined) { updates.push("content = ?"); params.push(args.content); }
    if (args.appliesWhen !== undefined) { updates.push("applies_when = ?"); params.push(args.appliesWhen); }
    if (args.tags !== undefined) { updates.push("tags = ?"); params.push(JSON.stringify(args.tags)); }
    if (args.trustScore !== undefined) {
      updates.push("trust_score = ?"); params.push(args.trustScore);
      let label: "high" | "low" | "unproven";
      if (args.trustScore >= 0.7) label = "high";
      else if (args.trustScore <= 0.3) label = "low";
      else label = "unproven";
      updates.push("trust_label = ?"); params.push(label);
    }
    if (args.status !== undefined) { updates.push("status = ?"); params.push(args.status); }
    if (args.supersededBy !== undefined) { updates.push("superseded_by = ?"); params.push(args.supersededBy); }

    if (updates.length === 0) return { content: [{ type: "text", text: "No updates provided" }], isError: true };

    updates.push("updated_at = ?"); params.push(Date.now()); params.push(args.id);
    db.prepare(`UPDATE memories SET ${updates.join(", ")} WHERE id = ?`).run(...params);

    const updated = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.id);
    return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
  });

  // memory_delete
  server.registerTool("memory_delete", {
    title: "Delete Memory",
    description: "Soft delete (archive) or hard delete a memory",
    inputSchema: { id: z.string().min(1), hard: z.boolean().default(false) },
  }, async (args) => {
    const existing = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.id);
    if (!existing) return { content: [{ type: "text", text: `Memory not found: ${args.id}` }], isError: true };

    if (args.hard) {
      db.prepare("DELETE FROM memories WHERE id = ?").run(args.id);
      db.prepare("DELETE FROM trust_calibration WHERE memory_id = ?").run(args.id);
      return { content: [{ type: "text", text: `Memory permanently deleted: ${args.id}` }] };
    } else {
      db.prepare("UPDATE memories SET status = 'archived', updated_at = ? WHERE id = ?").run(Date.now(), args.id);
      return { content: [{ type: "text", text: `Memory archived: ${args.id}` }] };
    }
  });

  // memory_synthesize
  server.registerTool("memory_synthesize", {
    title: "Synthesize Memories",
    description: "Combine multiple memories into a synthesized answer for a question",
    inputSchema: { memoryIds: z.array(z.string()).min(1), project: z.string().min(1), question: z.string().min(1) },
  }, async (args) => {
    const placeholders = args.memoryIds.map(() => "?").join(",");
    const rows = db.prepare(`SELECT * FROM memories WHERE id IN (${placeholders})`).all(...args.memoryIds) as any[];

    if (rows.length === 0) return { content: [{ type: "text", text: "No memories found for synthesis" }], isError: true };

    const synthesis = {
      question: args.question,
      sources: rows.map(r => ({ id: r.id, content: r.content, appliesWhen: r.applies_when, trustLabel: r.trust_label, evidenceRefs: JSON.parse(r.evidence_refs) })),
      combinedInsights: rows.filter(r => r.trust_label === "high").map(r => r.content).join("\n---\n"),
      conflictingViews: rows.filter(r => r.trust_label === "low").map(r => r.content).join("\n---\n"),
      generatedAt: Date.now(),
    };

    return { content: [{ type: "text", text: JSON.stringify(synthesis, null, 2) }] };
  });

  // memory_wakeup
  server.registerTool("memory_wakeup", {
    title: "Wakeup Memory",
    description: "Session-start digest with high-trust memories, recent activity, and protocol reminder",
    inputSchema: { project: z.string().min(1), sessionId: z.string().min(1) },
  }, async (args) => {
    db.prepare(`
      INSERT OR REPLACE INTO sessions (id, project, started_at, last_active_at, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(args.sessionId, args.project, Date.now(), Date.now(), "{}");

    const highTrust = db.prepare(`
      SELECT * FROM memories WHERE project = ? AND trust_label = 'high' AND status = 'active'
      ORDER BY trust_score DESC, updated_at DESC LIMIT 5
    `).all(args.project) as any[];

    const recent = db.prepare(`
      SELECT * FROM memories WHERE project = ? AND status = 'active'
      ORDER BY updated_at DESC LIMIT 10
    `).all(args.project) as any[];

    const needsReview = db.prepare(`
      SELECT * FROM memories WHERE project = ? AND trust_label = 'unproven' AND status = 'active'
      ORDER BY created_at DESC LIMIT 5
    `).all(args.project) as any[];

    const digest = {
      sessionId: args.sessionId, project: args.project, timestamp: Date.now(),
      highTrustMemories: highTrust.map(r => ({ id: r.id, summary: r.content.slice(0, 200), appliesWhen: r.applies_when, trustScore: r.trust_score })),
      recentActivity: recent.map(r => ({ id: r.id, summary: r.content.slice(0, 150), updatedAt: r.updated_at })),
      needsReview: needsReview.map(r => ({ id: r.id, summary: r.content.slice(0, 150), appliesWhen: r.applies_when })),
      protocolReminder: "Remember: search memory before answering; write grounded insights; trust labels are population quantiles (high=co-occurred with success, low=co-occurred with failure, unproven=too little evidence).",
    };

    return { content: [{ type: "text", text: JSON.stringify(digest, null, 2) }] };
  });

  // memory_stats
  server.registerTool("memory_stats", {
    title: "Memory Stats",
    description: "Project and global memory statistics with trust distribution and top tags",
    inputSchema: { project: z.string().optional() },
  }, async (args) => {
    const project = args.project || process.env.MEMORY_WORTH_PROJECT || "default";

    const projectStats = db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status='archived' THEN 1 ELSE 0 END) as archived,
        SUM(CASE WHEN status='superseded' THEN 1 ELSE 0 END) as superseded,
        SUM(CASE WHEN trust_label='high' THEN 1 ELSE 0 END) as high_trust,
        SUM(CASE WHEN trust_label='low' THEN 1 ELSE 0 END) as low_trust,
        SUM(CASE WHEN trust_label='unproven' THEN 1 ELSE 0 END) as unproven,
        AVG(trust_score) as avg_trust FROM memories WHERE project = ?
    `).get(project);

    const globalStats = db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN trust_label='high' THEN 1 ELSE 0 END) as high_trust, AVG(trust_score) as avg_trust
      FROM memories WHERE scope = 'global'
    `).get();

    const tagCounts = db.prepare(`
      SELECT json_each.value as tag, COUNT(*) as count FROM memories, json_each(tags)
      WHERE project = ? AND status = 'active' GROUP BY json_each.value ORDER BY count DESC LIMIT 20
    `).all(project);

    return { content: [{ type: "text", text: JSON.stringify({ project, projectStats, globalStats, topTags: tagCounts }, null, 2) }] };
  });

  // memory_tune
  server.registerTool("memory_tune", {
    title: "Tune Memory",
    description: "Adjust trust score thresholds and relabel memories",
    inputSchema: { project: z.string().optional(), highThreshold: z.number().min(0).max(1).optional(), lowThreshold: z.number().min(0).max(1).optional() },
  }, async (args) => {
    const project = args.project || process.env.MEMORY_WORTH_PROJECT || "default";
    const quantiles = getPopulationQuantiles(db);
    const currentHigh = args.highThreshold ?? quantiles.high;
    const currentLow = args.lowThreshold ?? quantiles.low;

    const memories = db.prepare(`SELECT id, trust_score FROM memories WHERE project = ? AND status = 'active'`).all(project) as { id: string; trust_score: number }[];

    for (const m of memories) {
      let label: "high" | "low" | "unproven";
      if (m.trust_score >= currentHigh) label = "high";
      else if (m.trust_score <= currentLow) label = "low";
      else label = "unproven";
      db.prepare("UPDATE memories SET trust_label = ?, updated_at = ? WHERE id = ?").run(label, Date.now(), m.id);
    }

    return { content: [{ type: "text", text: JSON.stringify({ project, previousQuantiles: quantiles, newThresholds: { high: currentHigh, low: currentLow }, relabeledCount: memories.length }, null, 2) }] };
  });

  // memory_invalidate
  server.registerTool("memory_invalidate", {
    title: "Invalidate Memory",
    description: "Mark a memory as superseded by another with a reason",
    inputSchema: { id: z.string().min(1), supersededBy: z.string().min(1), reason: z.string().min(1) },
  }, async (args) => {
    const existing = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.id) as any;
    if (!existing) return { content: [{ type: "text", text: `Memory not found: ${args.id}` }], isError: true };

    const superseding = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.supersededBy) as any;
    if (!superseding) return { content: [{ type: "text", text: `Superseding memory not found: ${args.supersededBy}` }], isError: true };

    db.prepare("UPDATE memories SET status = 'superseded', superseded_by = ?, updated_at = ? WHERE id = ?").run(args.supersededBy, Date.now(), args.id);
    const oldRefs = JSON.parse(superseding.evidence_refs);
    db.prepare("UPDATE memories SET evidence_refs = ?, updated_at = ? WHERE id = ?").run(JSON.stringify([...oldRefs, `invalidated:${args.id}:${args.reason}`]), Date.now(), args.supersededBy);

    return { content: [{ type: "text", text: JSON.stringify({ invalidated: args.id, supersededBy: args.supersededBy, reason: args.reason }, null, 2) }] };
  });

  // memory_merge
  server.registerTool("memory_merge", {
    title: "Merge Memories",
    description: "Merge multiple memories into a new one, superseding the originals",
    inputSchema: { memoryIds: z.array(z.string()).min(2), newContent: z.string().min(1), newAppliesWhen: z.string().min(1), project: z.string().min(1) },
  }, async (args) => {
    const placeholders = args.memoryIds.map(() => "?").join(",");
    const memories = db.prepare(`SELECT * FROM memories WHERE id IN (${placeholders})`).all(...args.memoryIds) as any[];
    if (memories.length !== args.memoryIds.length) return { content: [{ type: "text", text: "One or more memories not found" }], isError: true };

    const scope = determineWriteScope(args.newContent, args.newAppliesWhen);
    const id = crypto.randomUUID();
    const now = Date.now();
    const { score, label } = calculateTrustScore(id, db);
    const allRefs = memories.flatMap(m => JSON.parse(m.evidence_refs));

    db.prepare(`INSERT INTO memories (id, project, scope, content, applies_when, tags, trust_score, trust_label, evidence_refs, created_at, updated_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, args.project, scope, args.newContent, args.newAppliesWhen, "[]", score, label, JSON.stringify(allRefs), now, now, "active");

    for (const oldId of args.memoryIds) {
      db.prepare("UPDATE memories SET status = 'superseded', superseded_by = ?, updated_at = ? WHERE id = ?").run(id, now, oldId);
    }

    return { content: [{ type: "text", text: JSON.stringify({ mergedId: id, superseded: args.memoryIds, scope, trustScore: score, trustLabel: label }, null, 2) }] };
  });

  // memory_set_status
  server.registerTool("memory_set_status", {
    title: "Set Memory Status",
    description: "Change a memory's status (active/archived/superseded)",
    inputSchema: { id: z.string().min(1), status: z.enum(["active", "archived", "superseded"]) },
  }, async (args) => {
    const existing = db.prepare("SELECT * FROM memories WHERE id = ?").get(args.id);
    if (!existing) return { content: [{ type: "text", text: `Memory not found: ${args.id}` }], isError: true };

    db.prepare("UPDATE memories SET status = ?, updated_at = ? WHERE id = ?").run(args.status, Date.now(), args.id);
    return { content: [{ type: "text", text: JSON.stringify({ id: args.id, status: args.status }, null, 2) }] };
  });

  // memory_list_tools
  server.registerTool("memory_list_tools", {
    title: "List Tools",
    description: "List all available memory tools",
    inputSchema: {},
  }, async () => {
    const TOOLS = [
      { name: "memory_search", description: "Search memories by query, scope, trust level, and tags" },
      { name: "memory_get", description: "Retrieve a single memory by ID" },
      { name: "memory_write", description: "Create a new memory (requires applies_when)" },
      { name: "memory_update", description: "Update an existing memory's content, trust score, tags, or status" },
      { name: "memory_delete", description: "Soft delete (archive) or hard delete a memory" },
      { name: "memory_synthesize", description: "Combine multiple memories into a synthesized answer for a question" },
      { name: "memory_wakeup", description: "Session-start digest with high-trust memories, recent activity, and protocol reminder" },
      { name: "memory_stats", description: "Project and global memory statistics with trust distribution and top tags" },
      { name: "memory_tune", description: "Adjust trust score thresholds and relabel memories" },
      { name: "memory_invalidate", description: "Mark a memory as superseded by another with a reason" },
      { name: "memory_merge", description: "Merge multiple memories into a new one, superseding the originals" },
      { name: "memory_set_status", description: "Change a memory's status (active/archived/superseded)" },
      { name: "memory_list_tools", description: "List all available memory tools" },
    ];
    return { content: [{ type: "text", text: JSON.stringify(TOOLS, null, 2) }] };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("memory-worth-mcp server running on stdio");

  process.on("SIGINT", () => {
    console.error("Shutting down...");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Server error:", err);
  process.exit(1);
});