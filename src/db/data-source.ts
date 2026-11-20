import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { ensureDbDirectory, resolveDbPath } from '../utils/paths.js'
import { MemoryEntity } from './entities/memory.entity.js'
import { SessionEntity } from './entities/session.entity.js'
import { TrustCalibrationEntity } from './entities/trust-calibration.entity.js'

let dataSource: DataSource | null = null

export async function initializeDataSource(dbPath?: string): Promise<DataSource> {
  const path = dbPath || resolveDbPath()
  ensureDbDirectory(path)
  dataSource = new DataSource({
    type: 'better-sqlite3',
    database: path,
    entities: [MemoryEntity, SessionEntity, TrustCalibrationEntity],
    synchronize: true,
    logging: false,
  })
  await dataSource.initialize()
  await dataSource.query('PRAGMA journal_mode = WAL')
  await dataSource.query('PRAGMA foreign_keys = ON')
  return dataSource
}

export async function closeDataSource(): Promise<void> {
  if (dataSource) {
    await dataSource.destroy()
    dataSource = null
  }
}

export function getDataSource(): DataSource {
  if (!dataSource) {
    throw new Error('DataSource not initialized. Call initializeDataSource() first.')
  }
  return dataSource
}
