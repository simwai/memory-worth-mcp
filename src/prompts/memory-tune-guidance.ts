import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDatabase } from "../db/registry.js";

interface StatsRow {
  total: number;
  high: number;
  low: number;
  unproven: number;
  avg_trust: number | null;
}

export function registerMemoryTuneGuidancePrompt(server: McpServer): void {
  server.registerPrompt("memory-tune-guidance", {
    title: "Memory Tune Guidance",
    description: "Explain trust thresholds, calibration, and how to tune effectively",
    argsSchema: {
      project: z.string().min(1),
    },
  }, async ({ project }) => {
    const db = getDatabase();
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN trust_label='high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN trust_label='low' THEN 1 ELSE 0 END) as low,
        SUM(CASE WHEN trust_label='unproven' THEN 1 ELSE 0 END) as unproven,
        AVG(trust_score) as avg_trust
      FROM memories WHERE project = ? AND status = 'active'
    `).get(project) as StatsRow;

    const quantiles = db.prepare(`
      SELECT trust_score FROM memories WHERE project = ? AND status = 'active'
      ORDER BY trust_score
    `).all(project) as { trust_score: number }[];

    const sorted = quantiles.map(q => q.trust_score).sort((a, b) => a - b);
    const highIdx = Math.floor(sorted.length * 0.75);
    const lowIdx = Math.floor(sorted.length * 0.25);
    const popHigh = sorted[highIdx] ?? 0.7;
    const popLow = sorted[lowIdx] ?? 0.3;

    const prompt = `Trust Tuning Guidance for project "${project}"

## Current Distribution
- Total active: ${stats.total}
- High trust: ${stats.high} (${((stats.high / stats.total) * 100).toFixed(1)}%)
- Unproven: ${stats.unproven} (${((stats.unproven / stats.total) * 100).toFixed(1)}%)
- Low trust: ${stats.low} (${((stats.low / stats.total) * 100).toFixed(1)}%)
- Average trust: ${stats.avg_trust?.toFixed(3) ?? "N/A"}

## Current Thresholds (Population Quantiles)
- High threshold: ${popHigh.toFixed(3)} (75th percentile)
- Low threshold: ${popLow.toFixed(3)} (25th percentile)

## How Trust Works
1. **Calibration**: Each memory tracks outcomes (success/failure/neutral)
2. **Wilson Score**: 95% confidence lower bound of success rate
3. **Labels**: 
   - High: score ≥ high threshold (co-occurred with success)
   - Low: score ≤ low threshold (co-occurred with failure)
   - Unproven: between thresholds (insufficient evidence)

## Tuning Recommendations
- **Too many unproven?** → Calibrate more memories (5+ outcomes each)
- **Thresholds too strict?** → Use \`memory_tune\` with custom highThreshold/lowThreshold
- **Thresholds too loose?** → Let population quantiles auto-adjust

## When to Tune
- After significant calibration data accumulates
- When project scope changes significantly
- Before major synthesis/review sessions

Run \`memory_tune\` with custom thresholds or without args to use population quantiles.`;

    return {
      messages: [{ role: "user" as const, content: { type: "text" as const, text: prompt } }],
    };
  });
}