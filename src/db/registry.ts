import type { Database } from './database.js'

let dbInstance: Database | null = null

export function setDatabase(database: Database): void {
  dbInstance = database
}

export function getDatabase(): Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call setDatabase() first.')
  }
  return dbInstance
}

export function resetDatabase(): void {
  dbInstance = null
}
