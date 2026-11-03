import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";

let dbInstance: DatabaseType | null = null;

export function setDatabase(db: DatabaseType): void {
  dbInstance = db;
}

export function getDatabase(): DatabaseType {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call setDatabase() first.");
  }
  return dbInstance;
}