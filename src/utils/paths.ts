import { homedir } from "os";
import { join, dirname } from "path";
import { mkdirSync } from "fs";

export function resolveDbPath(): string {
  if (process.env.MEMORY_WORTH_DB) {
    return process.env.MEMORY_WORTH_DB;
  }

  if (process.env.MEMORY_WORTH_HOME) {
    return join(process.env.MEMORY_WORTH_HOME, "memory.db");
  }

  const base = process.env.LOCALAPPDATA
    ? process.env.LOCALAPPDATA
    : process.env.XDG_DATA_HOME
      ? process.env.XDG_DATA_HOME
      : join(homedir(), ".local", "share");

  return join(base, "memory-worth", "memory.db");
}

export function ensureDbDirectory(dbPath: string): void {
  const dir = dirname(dbPath);
  mkdirSync(dir, { recursive: true });
}