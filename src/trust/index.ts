import { Database } from "better-sqlite3";

export function calculateTrustScore(
  memoryId: string,
  db: Database
): { score: number; label: "high" | "low" | "unproven" } {
  const calibrations = db.prepare(
    "SELECT outcome FROM trust_calibration WHERE memory_id = ?"
  ).all(memoryId) as { outcome: string }[];

  if (calibrations.length < 5) {
    return { score: 0.5, label: "unproven" };
  }

  const successes = calibrations.filter(c => c.outcome === "success").length;
  const failures = calibrations.filter(c => c.outcome === "failure").length;
  const total = successes + failures;

  if (total === 0) return { score: 0.5, label: "unproven" };

  // Wilson score interval for binomial proportion (95% confidence)
  const z = 1.96;
  const p = successes / total;
  const denominator = 1 + z * z / total;
  const centre = (p + z * z / (2 * total)) / denominator;
  const adjustment = (z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total))) / denominator;

  const lowerBound = centre - adjustment;
  const score = Math.max(0, Math.min(1, lowerBound));

  // Population quantile thresholds
  let label: "high" | "low" | "unproven";
  if (score >= 0.7) label = "high";
  else if (score <= 0.3) label = "low";
  else label = "unproven";

  return { score, label };
}

export function updateTrustScore(memoryId: string, db: Database): void {
  const { score, label } = calculateTrustScore(memoryId, db);
  db.prepare(
    "UPDATE memories SET trust_score = ?, trust_label = ?, updated_at = ? WHERE id = ?"
  ).run(score, label, Date.now(), memoryId);
}

export function recordCalibration(
  memoryId: string,
  outcome: "success" | "failure" | "neutral",
  db: Database
): void {
  db.prepare(
    "INSERT INTO trust_calibration (memory_id, outcome, recorded_at) VALUES (?, ?, ?)"
  ).run(memoryId, outcome, Date.now());
  updateTrustScore(memoryId, db);
}

export function getPopulationQuantiles(db: Database): { high: number; low: number } {
  // Get all trust scores for active memories
  const scores = db.prepare(
    "SELECT trust_score FROM memories WHERE status = 'active'"
  ).all() as { trust_score: number }[];

  if (scores.length === 0) return { high: 0.7, low: 0.3 };

  const sorted = scores.map(s => s.trust_score).sort((a, b) => a - b);
  const highIdx = Math.floor(sorted.length * 0.75); // 75th percentile = high
  const lowIdx = Math.floor(sorted.length * 0.25);   // 25th percentile = low

  return {
    high: sorted[highIdx] ?? 0.7,
    low: sorted[lowIdx] ?? 0.3
  };
}