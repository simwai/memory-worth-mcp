import type { DataSource } from 'typeorm'
import { ensureDbDirectory, resolveDbPath } from '../utils/paths.js'
import { initializeDataSource } from './data-source.js'
import { Database } from './database.js'
import { getDatabase, resetDatabase, setDatabase } from './registry.js'

let dataSource: DataSource | null = null

export async function initializeDatabase(dbPath?: string): Promise<Database> {
  const path = dbPath || resolveDbPath()
  ensureDbDirectory(path)
  dataSource = await initializeDataSource(path)
  const database = new Database(dataSource)
  setDatabase(database)
  return database
}

export async function closeDatabase(database: Database): Promise<void> {
  await database.close()
  resetDatabase()
  dataSource = null
}

export { getDatabase }
