import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getDatabase } from '../db/registry.js'
import { MemoryWakeupOutputSchema } from '../output-schemas.js'
import type { MemoryRowLike } from '../utils/mappers.js'

export function registerMemoryWakeup(server: McpServer): void {
  server.registerTool(
    'memory_wakeup',
    {
      title: 'Wakeup Memory',
      description:
        'Session-start digest with high-trust memories, recent activity, and protocol reminder',
      inputSchema: { project: z.string().min(1), sessionId: z.string().min(1) },
      outputSchema: MemoryWakeupOutputSchema,
    },
    async (args) => {
      const database = getDatabase()
      await database.run(
        `INSERT OR REPLACE INTO sessions (id, project, started_at, last_active_at, metadata)
      VALUES (?, ?, ?, ?, ?)`,
        args.sessionId,
        args.project,
        Date.now(),
        Date.now(),
        '{}',
      )

      const highTrust = (await database.all(
        `
      SELECT * FROM memories WHERE project = ? AND trust_label = 'high' AND status = 'active'
      ORDER BY trust_score DESC, updated_at DESC LIMIT 5
    `,
        args.project,
      )) as MemoryRowLike[]

      const recent = (await database.all(
        `
      SELECT * FROM memories WHERE project = ? AND status = 'active'
      ORDER BY updated_at DESC LIMIT 10
    `,
        args.project,
      )) as MemoryRowLike[]

      const needsReview = (await database.all(
        `
      SELECT * FROM memories WHERE project = ? AND trust_label = 'unproven' AND status = 'active'
      ORDER BY created_at DESC LIMIT 5
    `,
        args.project,
      )) as MemoryRowLike[]

      const result = {
        sessionId: args.sessionId,
        project: args.project,
        timestamp: Date.now(),
        highTrustMemories: highTrust.map((row) => ({
          id: row.id,
          summary: row.content.slice(0, 200),
          appliesWhen: row.applies_when,
          trustScore: row.trust_score,
        })),
        recentActivity: recent.map((row) => ({
          id: row.id,
          summary: row.content.slice(0, 150),
          updatedAt: row.updated_at,
        })),
        needsReview: needsReview.map((row) => ({
          id: row.id,
          summary: row.content.slice(0, 150),
          appliesWhen: row.applies_when,
        })),
        protocolReminder:
          'Remember: search memory before answering; write grounded insights; trust labels are population quantiles (high=co-occurred with success, low=co-occurred with failure, unproven=too little evidence).',
      }
      return {
        structuredContent: result,
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    },
  )
}
