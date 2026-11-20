import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Database } from '../db/database.js'
import { getDatabase } from '../db/registry.js'
import { MemoryMergeOutputSchema } from '../output-schemas.js'
import { determineWriteScope } from '../routing/index.js'
import { calculateTrustScore } from '../trust/index.js'
import { logger } from '../utils/logger.js'

export function registerMemoryMerge(server: McpServer): void {
  server.registerTool(
    'memory_merge',
    {
      title: 'Merge Memories',
      description: 'Merge multiple memories into a new one, superseding the originals',
      inputSchema: {
        memoryIds: z.array(z.string()).min(2),
        newContent: z.string().min(1),
        newAppliesWhen: z.string().min(1),
        project: z.string().min(1),
      },
      outputSchema: MemoryMergeOutputSchema,
    },
    async (args, extra) => {
      const signal = extra.signal as AbortSignal | undefined
      const database = getDatabase()
      const placeholders = args.memoryIds.map(() => '?').join(',')
      const memories = (await database.all(
        `SELECT * FROM memories WHERE id IN (${placeholders})`,
        ...args.memoryIds,
      )) as { id: string; evidence_refs: string }[]
      const foundIds = new Set(memories.map((memory) => memory.id))
      const missing = args.memoryIds.filter((id) => !foundIds.has(id))
      if (missing.length > 0) {
        logger.warn('memory_merge', { memoryIds: args.memoryIds, missing, result: 'not_found' })
        return {
          isError: true,
          content: [{ type: 'text', text: `Memories not found: ${missing.join(', ')}` }],
        }
      }
      if (memories.length !== args.memoryIds.length) {
        logger.warn('memory_merge', { memoryIds: args.memoryIds, result: 'not_found' })
        return {
          isError: true,
          content: [{ type: 'text', text: 'One or more memories not found' }],
        }
      }
      logger.debug('memory_merge', { project: args.project, memoryIds: args.memoryIds })

      const scope = determineWriteScope(args.newContent, args.newAppliesWhen)
      const id = crypto.randomUUID()
      const now = Date.now()

      const allRefs = memories.flatMap((m) => {
        try {
          return JSON.parse(m.evidence_refs)
        } catch {
          return []
        }
      })

      const sourceScores = await Promise.all(
        memories.map((memory) => calculateTrustScore(memory.id, database)),
      ).then((results) => results.map((result) => result.score))
      const avgSourceScore = sourceScores.reduce((a, b) => a + b, 0) / sourceScores.length
      const { score } = await calculateTrustScore(id, database)

      const mergedTrustScore = avgSourceScore > 0 ? avgSourceScore : score
      const mergedTrustLabel =
        mergedTrustScore >= 0.7 ? 'high' : mergedTrustScore <= 0.3 ? 'low' : 'unproven'

      await database.transaction(async (tx: Database) => {
        await tx.run(
          `INSERT INTO memories (id, project, scope, content, applies_when, tags, trust_score, trust_label, evidence_refs, created_at, updated_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          id,
          args.project,
          scope,
          args.newContent,
          args.newAppliesWhen,
          '[]',
          mergedTrustScore,
          mergedTrustLabel,
          JSON.stringify(allRefs),
          now,
          now,
          'active',
        )

        for (let i = 0; i < args.memoryIds.length; i++) {
          if (signal?.aborted) {
            logger.warn('memory_merge', {
              project: args.project,
              cancelled: true,
              progress: i,
              total: args.memoryIds.length,
            })
            throw new Error('Operation cancelled')
          }
          const oldId = args.memoryIds[i]
          await tx.run(
            "UPDATE memories SET status = 'superseded', superseded_by = ?, updated_at = ? WHERE id = ?",
            id,
            now,
            oldId,
          )
        }
      })

      const extraWithProgress = extra as {
        sendProgress?: (update: {
          progress: number
          total: number
          message: string
        }) => Promise<void>
      }
      for (let i = 0; i < args.memoryIds.length; i++) {
        if (extraWithProgress.sendProgress) {
          await extraWithProgress.sendProgress({
            progress: i + 1,
            total: args.memoryIds.length,
            message: `Superseded ${args.memoryIds[i]}`,
          })
        }
      }

      const result = {
        mergedId: id,
        superseded: args.memoryIds,
        scope,
        trustScore: mergedTrustScore,
        trustLabel: mergedTrustLabel,
      }
      logger.info('memory_merge', {
        project: args.project,
        mergedId: id,
        supersededCount: args.memoryIds.length,
      })
      return {
        structuredContent: result,
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    },
  )
}
