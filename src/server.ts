import 'reflect-metadata'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { closeDatabase, initializeDatabase } from './db/index.js'
import { setDatabase } from './db/registry.js'
import { registerAllPrompts } from './prompts/index.js'
import { registerAllResources } from './resources/index.js'
import { registerAllTools } from './tools/index.js'

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'memory-worth-mcp', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  )

  registerAllTools(server)
  registerAllResources(server)
  registerAllPrompts(server)

  return server
}

export async function main(): Promise<void> {
  const database = await initializeDatabase()
  setDatabase(database)

  const server = createServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)

  const toolCount = (server as unknown as { _toolMap?: Map<string, unknown> })._toolMap?.size ?? 14
  const resourceCount =
    (server as unknown as { _resourceMap?: Map<string, unknown> })._resourceMap?.size ?? 5
  const promptCount =
    (server as unknown as { _promptMap?: Map<string, unknown> })._promptMap?.size ?? 4
  console.error(
    `memory-worth-mcp server running on stdio (tools: ${toolCount}, resources: ${resourceCount}, prompts: ${promptCount})`,
  )

  function shutdown(signal: string): void {
    console.error(`Shutting down on ${signal}...`)
    void closeDatabase(database)
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}
