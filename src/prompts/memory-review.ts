import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getDatabase } from '../db/registry.js'
import { type MemoryRowLike, rowToMemory } from '../utils/mappers.js'

export function registerMemoryReviewPrompt(server: McpServer): void {
  server.registerPrompt(
    'memory-review',
    {
      title: 'Memory Review Prompt',
      description: 'Generate a structured prompt for reviewing project memories',
      argsSchema: {
        project: z.string().min(1),
        focus: z.enum(['bugs', 'architecture', 'performance', 'all']).optional(),
      },
    },
    async ({ project, focus = 'all' }) => {
      const database = getDatabase()
      const memoryRows = (await database.all(
        `
      SELECT * FROM memories WHERE project = ? AND status = 'active'
      ORDER BY trust_score DESC, updated_at DESC
    `,
        project,
      )) as MemoryRowLike[]
      const memories = memoryRows.map(rowToMemory)

      const highTrust = memories.filter((memory) => memory.trustLabel === 'high')
      const unproven = memories.filter((memory) => memory.trustLabel === 'unproven')
      const lowTrust = memories.filter((memory) => memory.trustLabel === 'low')

      let focusFilter = memories
      if (focus === 'bugs') {
        focusFilter = memories.filter((memory) => memory.tags.includes('bug'))
      } else if (focus === 'architecture') {
        focusFilter = memories.filter(
          (memory) => memory.tags.includes('architecture') || memory.tags.includes('design'),
        )
      } else if (focus === 'performance') {
        focusFilter = memories.filter((memory) => memory.tags.includes('performance'))
      }

      const prompt = `Review the following memories for project "${project}" (focus: ${focus}):

## High-Trust Memories (${highTrust.length})
${highTrust
  .slice(0, 10)
  .map(
    (m) =>
      `- **${m.id}** (trust: ${m.trustScore.toFixed(2)}) ${m.content.slice(0, 200)}... [applies: ${m.appliesWhen}]`,
  )
  .join('\n')}

## Unproven Memories Needing Review (${unproven.length})
${unproven
  .slice(0, 10)
  .map((m) => `- **${m.id}** ${m.content.slice(0, 200)}... [applies: ${m.appliesWhen}]`)
  .join('\n')}

## Low-Trust Memories (${lowTrust.length})
${lowTrust
  .slice(0, 5)
  .map(
    (m) =>
      `- **${m.id}** (trust: ${m.trustScore.toFixed(2)}) ${m.content.slice(0, 200)}... [applies: ${m.appliesWhen}]`,
  )
  .join('\n')}

## Focus: ${focus} (${focusFilter.length} memories)
${focusFilter
  .slice(0, 10)
  .map((m) => `- **${m.id}** [${m.trustLabel}] ${m.content.slice(0, 200)}...`)
  .join('\n')}

---
**Review Tasks:**
1. Validate high-trust memories still apply
2. Calibrate unproven memories (mark success/failure)
3. Archive or invalidate low-trust memories
4. Merge related memories
5. Update tags for discoverability`

      return {
        messages: [{ role: 'user' as const, content: { type: 'text' as const, text: prompt } }],
      }
    },
  )
}
