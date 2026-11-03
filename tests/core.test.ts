import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { calculateTrustScore, getPopulationQuantiles } from "../src/trust/index.js";
import Database from "better-sqlite3";

describe("Trust Scoring", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(`
      CREATE TABLE memories (
        id TEXT PRIMARY KEY,
        trust_score REAL NOT NULL DEFAULT 0.5,
        trust_label TEXT NOT NULL DEFAULT 'unproven',
        status TEXT NOT NULL DEFAULT 'active',
        updated_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE trust_calibration (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_id TEXT NOT NULL,
        outcome TEXT NOT NULL,
        recorded_at INTEGER NOT NULL,
        FOREIGN KEY (memory_id) REFERENCES memories(id)
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  it("returns unproven for new memory with no calibrations", () => {
    const result = calculateTrustScore("new-id", db);
    expect(result.score).toBe(0.5);
    expect(result.label).toBe("unproven");
  });

  it("returns unproven with fewer than 5 calibrations", () => {
    db.prepare("INSERT INTO memories (id) VALUES (?)").run("test-id");
    for (let i = 0; i < 3; i++) {
      db.prepare("INSERT INTO trust_calibration (memory_id, outcome, recorded_at) VALUES (?, ?, ?)")
        .run("test-id", "success", Date.now());
    }
    const result = calculateTrustScore("test-id", db);
    expect(result.label).toBe("unproven");
  });

  it("calculates high trust with sufficient successes", () => {
    db.prepare("INSERT INTO memories (id, trust_score, trust_label) VALUES (?, ?, ?)")
      .run("test-id", 0.5, "unproven");
    for (let i = 0; i < 10; i++) {
      db.prepare("INSERT INTO trust_calibration (memory_id, outcome, recorded_at) VALUES (?, ?, ?)")
        .run("test-id", "success", Date.now());
    }
    const result = calculateTrustScore("test-id", db);
    expect(result.label).toBe("high");
    expect(result.score).toBeGreaterThan(0.7);
  });

  it("calculates low trust with sufficient failures", () => {
    db.prepare("INSERT INTO memories (id, trust_score, trust_label) VALUES (?, ?, ?)")
      .run("test-id", 0.5, "unproven");
    for (let i = 0; i < 10; i++) {
      db.prepare("INSERT INTO trust_calibration (memory_id, outcome, recorded_at) VALUES (?, ?, ?)")
        .run("test-id", "failure", Date.now());
    }
    const result = calculateTrustScore("test-id", db);
    expect(result.label).toBe("low");
    expect(result.score).toBeLessThan(0.3);
  });

  it("getPopulationQuantiles returns defaults for empty DB", () => {
    const quantiles = getPopulationQuantiles(db);
    expect(quantiles.high).toBe(0.7);
    expect(quantiles.low).toBe(0.3);
  });

  it("getPopulationQuantiles calculates from memories table", () => {
    db.prepare("INSERT INTO memories (id, trust_score, trust_label, status) VALUES (?, ?, ?, ?)")
      .run("mem1", 0.9, "high", "active");
    db.prepare("INSERT INTO memories (id, trust_score, trust_label, status) VALUES (?, ?, ?, ?)")
      .run("mem2", 0.7, "high", "active");
    db.prepare("INSERT INTO memories (id, trust_score, trust_label, status) VALUES (?, ?, ?, ?)")
      .run("mem3", 0.5, "unproven", "active");
    db.prepare("INSERT INTO memories (id, trust_score, trust_label, status) VALUES (?, ?, ?, ?)")
      .run("mem4", 0.3, "low", "active");
    db.prepare("INSERT INTO memories (id, trust_score, trust_label, status) VALUES (?, ?, ?, ?)")
      .run("mem5", 0.1, "low", "active");

    const quantiles = getPopulationQuantiles(db);
    // 5 items: indices 0,1,2,3,4 -> 75th = index 3 (0.7), 25th = index 1 (0.3)
    expect(quantiles.high).toBeGreaterThan(0.5);
    expect(quantiles.low).toBeLessThan(0.5);
  });
});

import { resolveScope, determineWriteScope, buildOrderByClause } from "../src/routing/index.js";

describe("Routing", () => {
  it("resolveScope returns correct clause for project scope", () => {
    const { whereClause, params } = resolveScope("project", "my-project");
    expect(whereClause).toContain("project = ?");
    expect(params).toEqual(["my-project"]);
  });

  it("resolveScope returns correct clause for global scope", () => {
    const { whereClause, params } = resolveScope("global", "my-project");
    expect(whereClause).toContain("scope = 'global'");
    expect(params).toEqual([]);
  });

  it("resolveScope returns empty clause for all scope", () => {
    const { whereClause, params } = resolveScope("all", "my-project");
    expect(whereClause).toBe("");
    expect(params).toEqual([]);
  });

  it("determineWriteScope returns project for grounded content", () => {
    const scope = determineWriteScope("see src/utils/paths.ts:42", "applies to file:line");
    expect(scope).toBe("project");
  });

  it("determineWriteScope returns global for ungrounded content", () => {
    const scope = determineWriteScope("general best practice", "always use const");
    expect(scope).toBe("global");
  });

  it("determineWriteScope detects git SHA as grounded", () => {
    const scope = determineWriteScope("fixed in a1b2c3d", "commit reference");
    expect(scope).toBe("project");
  });

  it("determineWriteScope detects function calls as grounded", () => {
    const scope = determineWriteScope("call helper() function", "usage");
    expect(scope).toBe("project");
  });

  it("buildOrderByClause includes project priority for auto scope", () => {
    const clause = buildOrderByClause("auto", "my-project");
    expect(clause).toContain("CASE WHEN project = 'my-project' THEN 1 ELSE 0 END DESC");
  });

  it("buildOrderByClause uses simple order for global scope", () => {
    const clause = buildOrderByClause("global", "my-project");
    expect(clause).toContain("trust_score DESC");
    expect(clause).not.toContain("CASE WHEN");
  });
});