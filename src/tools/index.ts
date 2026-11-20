import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerHealthCheck } from './health-check.js'
import { registerMemoryDelete } from './memory-delete.js'
import { registerMemoryGet } from './memory-get.js'
import { registerMemoryInvalidate } from './memory-invalidate.js'
import { registerMemoryListTools } from './memory-list-tools.js'
import { registerMemoryMerge } from './memory-merge.js'
import { registerMemorySearch } from './memory-search.js'
import { registerMemorySetStatus } from './memory-set-status.js'
import { registerMemoryStats } from './memory-stats.js'
import { registerMemorySynthesize } from './memory-synthesize.js'
import { registerMemoryTune } from './memory-tune.js'
import { registerMemoryUpdate } from './memory-update.js'
import { registerMemoryWakeup } from './memory-wakeup.js'
import { registerMemoryWrite } from './memory-write.js'

export function registerAllTools(server: McpServer): void {
  registerMemorySearch(server)
  registerMemoryGet(server)
  registerMemoryWrite(server)
  registerMemoryUpdate(server)
  registerMemoryDelete(server)
  registerMemorySynthesize(server)
  registerMemoryWakeup(server)
  registerMemoryStats(server)
  registerMemoryTune(server)
  registerMemoryInvalidate(server)
  registerMemoryMerge(server)
  registerMemorySetStatus(server)
  registerMemoryListTools(server)
  registerHealthCheck(server)
}
