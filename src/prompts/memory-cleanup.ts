import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getDatabase } from '../db/registry.js'
import { type MemoryRowLike, rowToMemory } from '../utils/mappers.js'

export function registerMemoryCleanupPrompt(server: McpServer): void {
  server.registerPrompt(
    'memory-cleanup',
    {
      title: 'Memory Cleanup Prompt',
      description: 'Generate a prompt for archiving stale or superseded memories',
      argsSchema: {
        project: z.string().min(1),
        olderThanDays: z.number().int().positive().default(90),
        includeSuperseded: z.boolean().default(true),
      },
    },
    async ({ project, olderThanDays, includeSuperseded }) => {
      const database = getDatabase()
      const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000

      const staleRows = (await database.all(
        `
      SELECT * FROM memories 
      WHERE project = ? AND status = 'active' AND updated_at < ?
    `,
        project,
        cutoff,
      )) as MemoryRowLike[]
      const stale = staleRows.map(rowToMemory)

      let superseded: typeof stale = []
      if (includeSuperseded) {
        const supersededRows = (await database.all(
          `
        SELECT * FROM memories WHERE project = ? AND status = 'superseded'
      `,
          project,
        )) as MemoryRowLike[]
        superseded = supersededRows.map(rowToMemory)
      }

      const prompt = `Cleanup candidates for project "${project}":

## Stale Memories (not updated in ${olderThanDays}+ days) — ${stale.length}
${stale
  .slice(0, 20)
  .map(
    (m) =>
      `- **${m.id}** (trust: ${m.trustLabel}, updated: ${new Date(m.updatedAt).toISOString().slice(0, 10)}) ${m.content.slice(0, 150)}... [applies: ${m.appliesWhen}]`,
  )
  .join('\n')}

${
  includeSuperseded
    ? `## Superseded Memories — ${superseded.length}
${superseded
  .slice(0, 10)
  .map(
    (m) =>
      `- **${m.id}** → superseded by ${m.supersededBy ?? 'unknown'}: ${m.content.slice(0, 150)}...`,
  )
  .join('\n')}`
    : ''
}

---
**Cleanup Actions:**
1. Archive stale memories that are no longer relevant
2. Keep stale memories that are still valid (update their updated_at)
3. Verify superseded memories have proper evidence_refs
4. Consider merging related stale memories before archiving

Run \`memory_update\` with status="archived" for items to archive.`

      return {
        messages: [{ role: 'user' as const, content: { type: 'text' as const, text: prompt } }],
      }
    },
  )
}
