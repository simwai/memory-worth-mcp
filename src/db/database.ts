import type { EntityManager } from 'typeorm'
import { DataSource } from 'typeorm'

type QueryExecutor = DataSource | EntityManager

export class Database {
  private readonly executor: QueryExecutor

  constructor(executor: QueryExecutor) {
    this.executor = executor
  }

  async get(sql: string, ...params: unknown[]): Promise<unknown | undefined> {
    const rows = await this.executor.query(sql, params)
    return rows[0] ?? undefined
  }

  async all(sql: string, ...params: unknown[]): Promise<unknown[]> {
    return this.executor.query(sql, params)
  }

  async run(sql: string, ...params: unknown[]): Promise<void> {
    await this.executor.query(sql, params)
  }

  async transaction<T>(fn: (txDatabase: Database) => Promise<T>): Promise<T> {
    if (this.executor instanceof DataSource) {
      return this.executor.transaction(async (manager: EntityManager) => {
        const tx = new Database(manager)
        return fn(tx)
      })
    }
    return fn(this)
  }

  async close(): Promise<void> {
    if (this.executor instanceof DataSource) {
      await this.executor.destroy()
    }
  }

  async exec(sql: string): Promise<void> {
    await this.executor.query(sql)
  }
}
