# memory-worth-mcp — MCP Best Practices Implementation Plan

## Overview
Elevate from solid MCP server (7/10) to context7-level (9-10/10) by adding resources, prompts, output schemas, modular structure, and observability.

---

## P0 — Core Structure (Do First)

### 1. Add Output Schemas to All Tools
**Effort:** Low (30 min) | **Impact:** High — type-safe clients, self-documenting

**Changes:**
- Each `registerTool` gets `outputSchema` with Zod object
- Return typed objects instead of JSON-stringified text
- Update tool handlers to return structured data

**Example:**
```typescript
server.registerTool("memory_search", {
  title: "Search Memories",
  description: "...",
  inputSchema: { ... },
  outputSchema: {
    memories: z.array(z.object({
      id: z.string(),
      project: z.string(),
      scope: z.enum(["project", "global"]),
      content: z.string(),
      appliesWhen: z.string(),
      tags: z.array(z.string()),
      trustScore: z.number(),
      trustLabel: z.enum(["high", "low", "unproven"]),
      evidenceRefs: z.array(z.string()),
      createdAt: z.number(),
      updatedAt: z.number(),
      status: z.enum(["active", "archived", "superseded"]),
    })),
    count: z.number(),
  },
}, async (args) => { ... });
```

**Files:** `src/mcp-server.ts` (or split tool files)

---

### 2. Split `mcp-server.ts` into Modular Tool Files
**Effort:** Medium (1 hr) | **Impact:** High — maintainability, matches context7 structure

**New Structure:**
```
src/
├── server.ts                 # Entry point, composes tools/resources/prompts
├── tools/
│   ├── index.ts              # registerAllTools(server)
│   ├── memory-search.ts      # registerMemorySearch(server)
│   ├── memory-get.ts
│   ├── memory-write.ts
│   ├── memory-update.ts
│   ├── memory-delete.ts
│   ├── memory-synthesize.ts
│   ├── memory-wakeup.ts
│   ├── memory-stats.ts
│   ├── memory-tune.ts
│   ├── memory-invalidate.ts
│   ├── memory-merge.ts
│   ├── memory-set-status.ts
│   └── memory-list-tools.ts
├── resources/
│   ├── index.ts              # registerAllResources(server)
│   ├── memory-export.ts
│   └── memory-import.ts
├── prompts/
│   ├── index.ts              # registerAllPrompts(server)
│   ├── memory-review.ts
│   └── memory-cleanup.ts
├── db/
│   └── index.ts
├── trust/
│   └── index.ts
├── routing/
│   └── index.ts
├── types/
│   └── index.ts
└── utils/
    └── paths.ts
```

**Migration:**
1. Create `src/tools/` with each tool in own file
2. Each exports `registerMemoryX(server)` with full tool definition
3. `src/tools/index.ts` re-exports and calls all
4. `src/server.ts` imports and calls `registerAllTools`, `registerAllResources`, `registerAllPrompts`

---

## P1 — Resources & Prompts (Context7 Parity)

### 3. Add Memory Resources
**Effort:** Medium (1 hr) | **Impact:** High — file-like access, enables LLM browsing

**Resources to Add:**
| URI Pattern | Description |
|-------------|-------------|
| `memory://project/{project}/memories` | List all memories (paginated) |
| `memory://project/{project}/memories/{id}` | Single memory detail |
| `memory://project/{project}/export` | Full JSON export |
| `memory://project/{project}/stats` | Statistics summary |
| `memory://global/memories` | Global scope memories |

**Implementation:**
```typescript
server.registerResource("memory-export", "memory://project/{project}/export", {
  title: "Project Memory Export",
  description: "Export all active memories for a project as JSON",
}, async (uri) => {
  const project = uri.href.split("/")[3]; // parse from URI
  const rows = db.prepare("SELECT * FROM memories WHERE project = ? AND status = 'active'").all(project);
  return {
    contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(rows, null, 2) }]
  };
});
```

---

### 4. Add Prompt Templates
**Effort:** Medium (45 min) | **Impact:** High — guided LLM workflows

**Prompts to Add:**
| Name | Args | Purpose |
|------|------|---------|
| `memory-review` | `project`, `focus?` | Generate review prompt for project memories |
| `memory-synthesis` | `project`, `question`, `memoryIds?` | Guided synthesis prompt |
| `memory-cleanup` | `project`, `olderThanDays?` | Prompt for archiving stale memories |
| `memory-tune-guidance` | `project` | Explain trust thresholds and calibration |

**Example:**
```typescript
server.registerPrompt("memory-review", {
  title: "Memory Review Prompt",
  description: "Generate a structured prompt for reviewing project memories",
  argsSchema: {
    project: z.string().min(1),
    focus: z.enum(["bugs", "architecture", "performance", "all"]).optional(),
  },
}, async ({ project, focus }) => {
  const memories = await getMemoriesForReview(project, focus);
  return {
    messages: [{
      role: "user",
      content: `Review the following memories for project "${project}"...`
    }]
  };
});
```

---

### 5. Progress Notifications for Long Operations
**Effort:** Low (30 min) | **Impact:** Medium — UX for `tune`, `merge`

**Tools needing progress:** `memory_tune`, `memory_merge`, `memory_synthesize` (large sets)

**Implementation:**
```typescript
server.registerTool("memory_tune", {
  ...
}, async (args, extra) => {
  const memories = db.prepare(...).all(project);
  const total = memories.length;
  
  for (let i = 0; i < memories.length; i++) {
    const m = memories[i];
    // ... relabel ...
    await extra.sendProgress({ progress: i + 1, total, message: `Relabeled ${m.id}` });
  }
  return { content: [{ type: "text", text: "..." }] };
});
```

---

## P2 — Observability & Health

### 6. Health Check Tool
**Effort:** Low (15 min) | **Impact:** Low — required for production deployment

```typescript
server.registerTool("health_check", {
  title: "Health Check",
  description: "Check server and database connectivity",
  inputSchema: {},
  outputSchema: {
    status: z.enum(["healthy", "degraded", "unhealthy"]),
    database: z.enum(["connected", "disconnected"]),
    memoryCount: z.number(),
    uptime: z.number(),
  },
}, async () => {
  try {
    const count = db.prepare("SELECT COUNT(*) as c FROM memories").get().c;
    return { status: "healthy", database: "connected", memoryCount: count, uptime: process.uptime() };
  } catch {
    return { status: "unhealthy", database: "disconnected", memoryCount: 0, uptime: process.uptime() };
  }
});
```

---

### 7. Structured JSON Logging
**Effort:** Low (30 min) | **Impact:** Low — production debugging

```typescript
// src/utils/logger.ts
export const logger = {
  info: (msg: string, meta?: object) => console.error(JSON.stringify({ level: "info", msg, ...meta, timestamp: Date.now() })),
  warn: (msg: string, meta?: object) => console.error(JSON.stringify({ level: "warn", msg, ...meta, timestamp: Date.now() })),
  error: (msg: string, meta?: object) => console.error(JSON.stringify({ level: "error", msg, ...meta, timestamp: Date.now() })),
};

// Usage in tools
logger.info("memory_search", { project, query: args.query, resultCount: rows.length });
```

---

## P3 — Advanced (Defer)

### 8. Request Cancellation Support
**Effort:** Medium | **Impact:** Medium — graceful shutdown for long ops

```typescript
// Check AbortSignal in tool handlers
server.registerTool("memory_tune", {
  ...
}, async (args, extra) => {
  const signal = extra.signal; // AbortSignal from SDK
  for (const m of memories) {
    if (signal.aborted) throw new Error("Cancelled");
    // ...
  }
});
```

### 9. Rate Limiting / Quotas
**Effort:** Medium | **Impact:** Medium — multi-tenant safety

### 10. HTTP Transport + Connection Pooling
**Effort:** High | **Impact:** High — only if moving beyond stdio

---

## Execution Order

```
Week 1 (Core):
  □ 1. Output schemas (30m)
  □ 2. Modularize tools (1h)
  □ 3. Resources (1h)

Week 2 (Context7 Parity):
  □ 4. Prompts (45m)
  □ 5. Progress notifications (30m)
  □ 6. Health check (15m)
  □ 7. Structured logging (30m)

Later:
  □ 8. Cancellation
  □ 9. Rate limiting
  □ 10. HTTP transport
```

---

## Acceptance Criteria

| Feature | Done When |
|---------|-----------|
| Output schemas | All 13 tools return typed `outputSchema` |
| Modular tools | `src/mcp-server.ts` < 100 lines, each tool in `src/tools/` |
| Resources | 5+ `memory://` URIs registered, browsable |
| Prompts | 4+ prompts registered, tested via MCP client |
| Progress | `tune`/`merge` emit progress events |
| Health check | `health_check` tool returns structured status |
| Logging | All tools emit JSON logs to stderr |

---

## Dependencies

- **No new deps needed** — all use existing `@modelcontextprotocol/sdk`, `zod`
- **TypeScript config** — ensure `composite: true` if splitting into sub-projects later
- **Tests** — add integration tests for resources/prompts in `tests/integration.test.ts`