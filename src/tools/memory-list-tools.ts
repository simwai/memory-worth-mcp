import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { MemoryListToolsOutputSchema } from '../output-schemas.js'

type RegisteredTool = {
  enabled?: boolean
  description?: string
}

function discoverTools(server: McpServer): { name: string; description: string }[] {
  const registeredTools =
    (server as unknown as { _registeredTools?: Record<string, RegisteredTool> })._registeredTools ??
    {}
  return Object.entries(registeredTools)
    .filter(([, registeredTool]) => registeredTool.enabled !== false)
    .map(([name, registeredTool]) => ({ name, description: registeredTool.description ?? '' }))
}

export function registerMemoryListTools(server: McpServer): void {
  server.registerTool(
    'memory_list_tools',
    {
      title: 'List Tools',
      description: 'List all available memory tools',
      inputSchema: {},
      outputSchema: MemoryListToolsOutputSchema,
    },
    async () => {
      const tools = discoverTools(server)
      const result = { tools }
      return {
        structuredContent: result,
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    },
  )
}
