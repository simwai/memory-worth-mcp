import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'
import { getDatabase } from '../db/registry.js'
import { type MemoryRowLike, rowToMemory } from '../utils/mappers.js'

export function registerMemoryGetResource(server: McpServer): void {
  server.registerResource(
    'memory-get',
    new ResourceTemplate('memory://project/{project}/memories/{id}', {
      list: undefined,
    }),
    {
      title: 'Single Memory',
      description: 'A single memory as a JSON document',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const database = getDatabase()
      const row = (await database.get(
        'SELECT * FROM memories WHERE id = ? AND project = ?',
        variables.id,
        variables.project,
      )) as MemoryRowLike | undefined
      if (!row) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Memory not found: ${variables.id} (project: ${variables.project})`,
        )
      }
      const memory = rowToMemory(row)
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(memory, null, 2),
          },
        ],
      }
    },
  )
}
