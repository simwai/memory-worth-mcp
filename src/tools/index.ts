import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import { registerMemorySearch } from "./memory-search.js";
import { registerMemoryGet } from "./memory-get.js";
import { registerMemoryWrite } from "./memory-write.js";
import { registerMemoryUpdate } from "./memory-update.js";
import { registerMemoryDelete } from "./memory-delete.js";
import { registerMemorySynthesize } from "./memory-synthesize.js";
import { registerMemoryWakeup } from "./memory-wakeup.js";
import { registerMemoryStats } from "./memory-stats.js";
import { registerMemoryTune } from "./memory-tune.js";
import { registerMemoryInvalidate } from "./memory-invalidate.js";
import { registerMemoryMerge } from "./memory-merge.js";
import { registerMemorySetStatus } from "./memory-set-status.js";
import { registerMemoryListTools } from "./memory-list-tools.js";

export function registerAllTools(server: Server, db: DatabaseType): void {
  registerMemorySearch(server, db);
  registerMemoryGet(server, db);
  registerMemoryWrite(server, db);
  registerMemoryUpdate(server, db);
  registerMemoryDelete(server, db);
  registerMemorySynthesize(server, db);
  registerMemoryWakeup(server, db);
  registerMemoryStats(server, db);
  registerMemoryTune(server, db);
  registerMemoryInvalidate(server, db);
  registerMemoryMerge(server, db);
  registerMemorySetStatus(server, db);
  registerMemoryListTools(server);
}