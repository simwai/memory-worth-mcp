import { z } from "zod";

export const MemorySchema = z.object({
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
  supersededBy: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
});

export const MemorySearchOutputSchema = z.object({
  memories: z.array(MemorySchema),
  count: z.number(),
});

export const MemoryGetOutputSchema = z.object({
  memory: MemorySchema,
});

export const MemoryWriteOutputSchema = z.object({
  id: z.string(),
  scope: z.enum(["project", "global"]),
  trustScore: z.number(),
  trustLabel: z.enum(["high", "low", "unproven"]),
});

export const MemoryUpdateOutputSchema = z.object({
  memory: MemorySchema,
});

export const MemoryDeleteOutputSchema = z.object({
  id: z.string(),
  action: z.enum(["archived", "deleted"]),
});

export const MemorySynthesizeOutputSchema = z.object({
  question: z.string(),
  sources: z.array(z.object({
    id: z.string(),
    content: z.string(),
    appliesWhen: z.string(),
    trustLabel: z.enum(["high", "low", "unproven"]),
    evidenceRefs: z.array(z.string()),
  })),
  combinedInsights: z.string(),
  conflictingViews: z.string(),
  generatedAt: z.number(),
});

export const MemoryWakeupOutputSchema = z.object({
  sessionId: z.string(),
  project: z.string(),
  timestamp: z.number(),
  highTrustMemories: z.array(z.object({
    id: z.string(),
    summary: z.string(),
    appliesWhen: z.string(),
    trustScore: z.number(),
  })),
  recentActivity: z.array(z.object({
    id: z.string(),
    summary: z.string(),
    updatedAt: z.number(),
  })),
  needsReview: z.array(z.object({
    id: z.string(),
    summary: z.string(),
    appliesWhen: z.string(),
  })),
  protocolReminder: z.string(),
});

export const MemoryStatsOutputSchema = z.object({
  project: z.string(),
  projectStats: z.object({
    total: z.number(),
    active: z.number(),
    archived: z.number(),
    superseded: z.number(),
    highTrust: z.number(),
    lowTrust: z.number(),
    unproven: z.number(),
    avgTrust: z.number().nullable(),
  }),
  globalStats: z.object({
    total: z.number(),
    active: z.number(),
    highTrust: z.number(),
    avgTrust: z.number().nullable(),
  }),
  topTags: z.array(z.object({
    tag: z.string(),
    count: z.number(),
  })),
});

export const MemoryTuneOutputSchema = z.object({
  project: z.string(),
  previousQuantiles: z.object({
    high: z.number(),
    low: z.number(),
  }),
  newThresholds: z.object({
    high: z.number(),
    low: z.number(),
  }),
  relabeledCount: z.number(),
});

export const MemoryInvalidateOutputSchema = z.object({
  invalidated: z.string(),
  supersededBy: z.string(),
  reason: z.string(),
});

export const MemoryMergeOutputSchema = z.object({
  mergedId: z.string(),
  superseded: z.array(z.string()),
  scope: z.enum(["project", "global"]),
  trustScore: z.number(),
  trustLabel: z.enum(["high", "low", "unproven"]),
});

export const MemorySetStatusOutputSchema = z.object({
  id: z.string(),
  status: z.enum(["active", "archived", "superseded"]),
});

export const MemoryListToolsOutputSchema = z.object({
  tools: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })),
});

export const HealthCheckOutputSchema = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  database: z.enum(["connected", "disconnected"]),
  memoryCount: z.number(),
  uptime: z.number(),
});