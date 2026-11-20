import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Database } from '../db/database.js'
import { getDatabase } from '../db/registry.js'
import { MemoryTuneOutputSchema } from '../output-schemas.js'
import { getPopulationQuantiles } from '../trust/index.js'
import { logger } from '../utils/logger.js'

export function registerMemoryTune(server: McpServer): void {
  server.registerTool(
    'memory_tune',
    {
      title: 'Tune Memory',
      description: 'Adjust trust score thresholds and relabel memories',
      inputSchema: {
        project: z.string().optional(),
        highThreshold: z.number().min(0).max(1).optional(),
        lowThreshold: z.number().min(0).max(1).optional(),
      },
      outputSchema: MemoryTuneOutputSchema,
    },
    async (args, extra) => {
      const signal = extra.signal as AbortSignal | undefined
      const database = getDatabase()
      const project = args.project || process.env.MEMORY_WORTH_PROJECT || 'default'

      if (
        args.highThreshold !== undefined &&
        args.lowThreshold !== undefined &&
        args.highThreshold <= args.lowThreshold
      ) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'highThreshold must be greater than lowThreshold' }],
        }
      }

      const quantiles = await getPopulationQuantiles(database)
      const currentHigh = args.highThreshold ?? quantiles.high
      const currentLow = args.lowThreshold ?? quantiles.low
      logger.debug('memory_tune', {
        project,
        highThreshold: currentHigh,
        lowThreshold: currentLow,
      })

      const memories = (await database.all(
        `SELECT id, trust_score FROM memories WHERE project = ? AND status = 'active'`,
        project,
      )) as { id: string; trust_score: number }[]
      const total = memories.length

      const labels: { id: string; label: 'high' | 'low' | 'unproven' }[] = []
      for (let i = 0; i < memories.length; i++) {
        if (signal?.aborted) {
          logger.warn('memory_tune', { project, cancelled: true, progress: i, total })
          throw new Error('Operation cancelled')
        }
        const m = memories[i]
        let label: 'high' | 'low' | 'unproven'
        if (m.trust_score >= currentHigh) label = 'high'
        else if (m.trust_score <= currentLow) label = 'low'
        else label = 'unproven'
        labels.push({ id: m.id, label })
      }

      await database.transaction(async (tx: Database) => {
        for (const { id, label } of labels) {
          await tx.run(
            'UPDATE memories SET trust_label = ?, updated_at = ? WHERE id = ?',
            label,
            Date.now(),
            id,
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
      for (let i = 0; i < labels.length; i++) {
        if (extraWithProgress.sendProgress) {
          await extraWithProgress.sendProgress({
            progress: i + 1,
            total,
            message: `Relabeled ${labels[i].id} → ${labels[i].label}`,
          })
        }
      }

      const result = {
        project,
        previousQuantiles: quantiles,
        newThresholds: { high: currentHigh, low: currentLow },
        relabeledCount: total,
      }
      logger.info('memory_tune', { project, relabeledCount: total })
      return {
        structuredContent: result,
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    },
  )
}
