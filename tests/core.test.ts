import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Database } from '../src/db/database.js'
import { calculateTrustScore, getPopulationQuantiles } from '../src/trust/index.js'

describe('Trust Scoring', () => {
  let dataSource: DataSource
  let db: Database

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: false,
      logging: false,
    })
    await dataSource.initialize()
    db = new Database(dataSource)
    await db.exec(`CREATE TABLE memories (
      id TEXT PRIMARY KEY,
      trust_score REAL NOT NULL DEFAULT 0.5,
      trust_label TEXT NOT NULL DEFAULT 'unproven',
      status TEXT NOT NULL DEFAULT 'active',
      updated_at INTEGER NOT NULL DEFAULT 0
    )`)
    await db.exec(`CREATE TABLE trust_calibration (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memory_id TEXT NOT NULL,
      outcome TEXT NOT NULL,
      recorded_at INTEGER NOT NULL,
      FOREIGN KEY (memory_id) REFERENCES memories(id)
    )`)
  })

  afterEach(async () => {
    await db.close()
  })

  it('returns unproven for new memory with no calibrations', async () => {
    const result = await calculateTrustScore('new-id', db)
    expect(result.score).toBe(0.5)
    expect(result.label).toBe('unproven')
  })

  it('returns unproven with fewer than 5 calibrations', async () => {
    await db.run('INSERT INTO memories (id) VALUES (?)', 'test-id')
    for (let i = 0; i < 3; i++) {
      await db.run(
        'INSERT INTO trust_calibration (memory_id, outcome, recorded_at) VALUES (?, ?, ?)',
        'test-id',
        'success',
        Date.now(),
      )
    }
    const result = await calculateTrustScore('test-id', db)
    expect(result.label).toBe('unproven')
  })

  it('calculates high trust with sufficient successes', async () => {
    await db.run(
      'INSERT INTO memories (id, trust_score, trust_label) VALUES (?, ?, ?)',
      'test-id',
      0.5,
      'unproven',
    )
    for (let i = 0; i < 10; i++) {
      await db.run(
        'INSERT INTO trust_calibration (memory_id, outcome, recorded_at) VALUES (?, ?, ?)',
        'test-id',
        'success',
        Date.now(),
      )
    }
    const result = await calculateTrustScore('test-id', db)
    expect(result.label).toBe('high')
    expect(result.score).toBeGreaterThan(0.7)
  })

  it('calculates low trust with sufficient failures', async () => {
    await db.run(
      'INSERT INTO memories (id, trust_score, trust_label) VALUES (?, ?, ?)',
      'test-id',
      0.5,
      'unproven',
    )
    for (let i = 0; i < 10; i++) {
      await db.run(
        'INSERT INTO trust_calibration (memory_id, outcome, recorded_at) VALUES (?, ?, ?)',
        'test-id',
        'failure',
        Date.now(),
      )
    }
    const result = await calculateTrustScore('test-id', db)
    expect(result.label).toBe('low')
    expect(result.score).toBeLessThan(0.3)
  })

  it('getPopulationQuantiles returns defaults for empty DB', async () => {
    const quantiles = await getPopulationQuantiles(db)
    expect(quantiles.high).toBe(0.7)
    expect(quantiles.low).toBe(0.3)
  })

  it('getPopulationQuantiles calculates from memories table', async () => {
    await db.run(
      'INSERT INTO memories (id, trust_score, trust_label, status) VALUES (?, ?, ?, ?)',
      'mem1',
      0.9,
      'high',
      'active',
    )
    await db.run(
      'INSERT INTO memories (id, trust_score, trust_label, status) VALUES (?, ?, ?, ?)',
      'mem2',
      0.7,
      'high',
      'active',
    )
    await db.run(
      'INSERT INTO memories (id, trust_score, trust_label, status) VALUES (?, ?, ?, ?)',
      'mem3',
      0.5,
      'unproven',
      'active',
    )
    await db.run(
      'INSERT INTO memories (id, trust_score, trust_label, status) VALUES (?, ?, ?, ?)',
      'mem4',
      0.3,
      'low',
      'active',
    )
    await db.run(
      'INSERT INTO memories (id, trust_score, trust_label, status) VALUES (?, ?, ?, ?)',
      'mem5',
      0.1,
      'low',
      'active',
    )

    const quantiles = await getPopulationQuantiles(db)
    expect(quantiles.high).toBeGreaterThan(0.5)
    expect(quantiles.low).toBeLessThan(0.5)
  })
})

import { buildOrderByClause, determineWriteScope, resolveScope } from '../src/routing/index.js'

describe('Routing', () => {
  it('resolveScope returns correct clause for project scope', () => {
    const { whereClause, params } = resolveScope('project', 'my-project')
    expect(whereClause).toContain('project = ?')
    expect(params).toEqual(['my-project'])
  })

  it('resolveScope returns correct clause for global scope', () => {
    const { whereClause, params } = resolveScope('global', 'my-project')
    expect(whereClause).toContain("scope = 'global'")
    expect(params).toEqual([])
  })

  it('resolveScope returns empty clause for all scope', () => {
    const { whereClause, params } = resolveScope('all', 'my-project')
    expect(whereClause).toBe('')
    expect(params).toEqual([])
  })

  it('determineWriteScope returns project for grounded content', () => {
    const scope = determineWriteScope('see src/utils/paths.ts:42', 'applies to file:line')
    expect(scope).toBe('project')
  })

  it('determineWriteScope returns global for ungrounded content', () => {
    const scope = determineWriteScope('general best practice', 'always use const')
    expect(scope).toBe('global')
  })

  it('determineWriteScope detects git SHA as grounded', () => {
    const scope = determineWriteScope('fixed in a1b2c3d', 'commit reference')
    expect(scope).toBe('project')
  })

  it('determineWriteScope detects function calls as grounded', () => {
    const scope = determineWriteScope('call helper() function', 'usage')
    expect(scope).toBe('project')
  })

  it('buildOrderByClause includes project priority placeholder for auto scope', () => {
    const { orderBy, params } = buildOrderByClause('auto', 'my-project')
    expect(orderBy).toContain('CASE WHEN project = ? THEN 1 ELSE 0 END DESC')
    expect(params).toEqual(['my-project'])
  })

  it('buildOrderByClause uses simple order for global scope', () => {
    const { orderBy, params } = buildOrderByClause('global', 'my-project')
    expect(orderBy).toContain('trust_score DESC')
    expect(orderBy).not.toContain('CASE WHEN')
    expect(params).toEqual([])
  })
})
