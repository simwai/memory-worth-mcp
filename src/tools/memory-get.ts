import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getDatabase } from '../db/registry.js'
import { MemoryGetOutputSchema } from '../output-schemas.js'
import { logger } from '../utils/logger.js'
import { type MemoryRowLike, rowToMemory } from '../utils/mappers.js'

export function registerMemoryGet(server: McpServer): void {
  server.registerTool(
    'memory_get',
    {
      title: 'Get Memory',
      description: 'Retrieve a single memory by ID',
      inputSchema: { id: z.string().min(1) },
      outputSchema: MemoryGetOutputSchema,
    },
    async (args) => {
      const database = getDatabase()
      const row = (await database.get('SELECT * FROM memories WHERE id = ?', args.id)) as
        | MemoryRowLike
        | undefined
      if (!row) {
        logger.warn('memory_get', { id: args.id, result: 'not_found' })
        return {
          isError: true,
          content: [{ type: 'text', text: `Memory not found: ${args.id}` }],
        }
      }
      const memory = rowToMemory(row)
      logger.info('memory_get', { id: args.id, result: 'found' })
      return {
        structuredContent: { memory },
        content: [{ type: 'text', text: JSON.stringify({ memory }, null, 2) }],
      }
    },
  )
}
