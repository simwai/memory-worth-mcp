import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Database } from '../db/database.js'
import { getDatabase } from '../db/registry.js'
import { MemoryInvalidateOutputSchema } from '../output-schemas.js'

export function registerMemoryInvalidate(server: McpServer): void {
  server.registerTool(
    'memory_invalidate',
    {
      title: 'Invalidate Memory',
      description: 'Mark a memory as superseded by another with a reason',
      inputSchema: {
        id: z.string().min(1),
        supersededBy: z.string().min(1),
        reason: z.string().min(1),
      },
      outputSchema: MemoryInvalidateOutputSchema,
    },
    async (args) => {
      if (args.id === args.supersededBy) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'A memory cannot supersede itself' }],
        }
      }

      const database = getDatabase()
      const existing = await database.get('SELECT * FROM memories WHERE id = ?', args.id)
      if (!existing) {
        return { isError: true, content: [{ type: 'text', text: `Memory not found: ${args.id}` }] }
      }

      const superseding = (await database.get(
        'SELECT * FROM memories WHERE id = ?',
        args.supersededBy,
      )) as { evidence_refs: string } | undefined
      if (!superseding) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Superseding memory not found: ${args.supersededBy}` }],
        }
      }

      await database.transaction(async (tx: Database) => {
        await tx.run(
          "UPDATE memories SET status = 'superseded', superseded_by = ?, updated_at = ? WHERE id = ?",
          args.supersededBy,
          Date.now(),
          args.id,
        )
        let oldRefs: string[] = []
        try {
          oldRefs = JSON.parse(superseding.evidence_refs as string)
          if (!Array.isArray(oldRefs)) oldRefs = []
        } catch {
          oldRefs = []
        }
        await tx.run(
          'UPDATE memories SET evidence_refs = ?, updated_at = ? WHERE id = ?',
          JSON.stringify([...oldRefs, `invalidated:${args.id}:${args.reason}`]),
          Date.now(),
          args.supersededBy,
        )
      })

      const result = { invalidated: args.id, supersededBy: args.supersededBy, reason: args.reason }
      return {
        structuredContent: result,
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    },
  )
}
