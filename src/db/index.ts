import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import { resolveDbPath, ensureDbDirectory } from "../utils/paths.js";

const SCHEMA = `
-- Memories table
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'project',
  content TEXT NOT NULL,
  applies_when TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  trust_score REAL NOT NULL DEFAULT 0.5,
  trust_label TEXT NOT NULL DEFAULT 'unproven',
  evidence_refs TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  superseded_by TEXT,
  session_id TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project);
CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope);
CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status);
CREATE INDEX IF NOT EXISTS idx_memories_trust ON memories(trust_score);
CREATE INDEX IF NOT EXISTS idx_memories_applies_when ON memories(applies_when);

-- Sessions table (for wakeup)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}'
);

-- Trust calibration table (for quantile calculation)
CREATE TABLE IF NOT EXISTS trust_calibration (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  FOREIGN KEY (memory_id) REFERENCES memories(id)
);
CREATE INDEX IF NOT EXISTS idx_trust_calibration_memory ON trust_calibration(memory_id);
`;

export function initializeDatabase(dbPath?: string): DatabaseType {
  const path = dbPath || resolveDbPath();
  ensureDbDirectory(path);
  const db = new Database(path);
  db.exec(SCHEMA);
  db.pragma("journal_mode = WAL");
  return db;
}

export function closeDatabase(db: DatabaseType): void {
  db.close();
}