import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Database } from '../db/database.js'
import { getDatabase } from '../db/registry.js'
import { MemoryDeleteOutputSchema } from '../output-schemas.js'
import type { MemoryRowLike } from '../utils/mappers.js'

export function registerMemoryDelete(server: McpServer): void {
  server.registerTool(
    'memory_delete',
    {
      title: 'Delete Memory',
      description: 'Soft delete (archive) or hard delete a memory',
      inputSchema: { id: z.string().min(1), hard: z.boolean().default(false) },
      outputSchema: MemoryDeleteOutputSchema,
    },
    async (args) => {
      const database = getDatabase()
      const existing = (await database.get('SELECT * FROM memories WHERE id = ?', args.id)) as
        | MemoryRowLike
        | undefined
      if (!existing) {
        return { isError: true, content: [{ type: 'text', text: `Memory not found: ${args.id}` }] }
      }

      if (args.hard) {
        await database.transaction(async (tx: Database) => {
          await tx.run('DELETE FROM memories WHERE id = ?', args.id)
          await tx.run('DELETE FROM trust_calibration WHERE memory_id = ?', args.id)
        })
        const result = { id: args.id, action: 'deleted' as const }
        return {
          structuredContent: result,
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      } else {
        await database.run(
          "UPDATE memories SET status = 'archived', updated_at = ? WHERE id = ?",
          Date.now(),
          args.id,
        )
        const result = { id: args.id, action: 'archived' as const }
        return {
          structuredContent: result,
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      }
    },
  )
}
