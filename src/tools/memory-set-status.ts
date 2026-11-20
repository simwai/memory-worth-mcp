import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getDatabase } from '../db/registry.js'
import { MemorySetStatusOutputSchema } from '../output-schemas.js'

export function registerMemorySetStatus(server: McpServer): void {
  server.registerTool(
    'memory_set_status',
    {
      title: 'Set Memory Status',
      description: "Change a memory's status (active/archived/superseded)",
      inputSchema: {
        id: z.string().min(1),
        status: z.enum(['active', 'archived', 'superseded']),
        supersededBy: z.string().optional(),
      },
      outputSchema: MemorySetStatusOutputSchema,
    },
    async (args) => {
      const database = getDatabase()
      const existing = await database.get('SELECT * FROM memories WHERE id = ?', args.id)
      if (!existing) {
        return { isError: true, content: [{ type: 'text', text: `Memory not found: ${args.id}` }] }
      }

      if (args.status === 'superseded' && !args.supersededBy) {
        return {
          isError: true,
          content: [
            { type: 'text', text: "supersededBy is required when setting status to 'superseded'" },
          ],
        }
      }

      await database.run(
        'UPDATE memories SET status = ?, superseded_by = ?, updated_at = ? WHERE id = ?',
        args.status,
        args.supersededBy ?? null,
        Date.now(),
        args.id,
      )

      const result = { id: args.id, status: args.status }
      return {
        structuredContent: result,
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    },
  )
}
