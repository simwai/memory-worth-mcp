import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerMemoryExportResource } from './memory-export.js'
import { registerMemoryGetResource } from './memory-get.js'
import { registerMemoryGlobalResource } from './memory-global.js'
import { registerMemoryListResource } from './memory-list.js'
import { registerMemoryStatsResource } from './memory-stats.js'

export function registerAllResources(server: McpServer): void {
  registerMemoryExportResource(server)
  registerMemoryListResource(server)
  registerMemoryGetResource(server)
  registerMemoryStatsResource(server)
  registerMemoryGlobalResource(server)
}
