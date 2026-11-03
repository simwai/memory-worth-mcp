import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDatabase } from "../db/registry.js";

export function registerMemorySynthesisPrompt(server: McpServer): void {
  server.registerPrompt("memory-synthesis", {
    title: "Memory Synthesis Prompt",
    description: "Generate a guided synthesis prompt for a question across project memories",
    argsSchema: {
      project: z.string().min(1),
      question: z.string().min(1),
      memoryIds: z.array(z.string()).optional(),
      minTrust: z.number().min(0).max(1).optional(),
    },
  }, async ({ project, question, memoryIds, minTrust = 0.3 }) => {
    const db = getDatabase();
    let memories;
    if (memoryIds?.length) {
      const placeholders = memoryIds.map(() => "?").join(",");
      memories = db.prepare(`SELECT * FROM memories WHERE id IN (${placeholders})`).all(...memoryIds) as any[];
    } else {
      memories = db.prepare(`
        SELECT * FROM memories WHERE project = ? AND status = 'active' AND trust_score >= ?
        ORDER BY trust_score DESC
      `).all(project, minTrust) as any[];
    }

    const highTrust = memories.filter(m => m.trust_label === "high");
    const lowTrust = memories.filter(m => m.trust_label === "low");

    const prompt = `Synthesize an answer to: "${question}"

Using ${memories.length} memories from project "${project}" (min trust: ${minTrust}):

## High-Trust Sources (${highTrust.length})
${highTrust.map(m => `**${m.id}** (trust: ${m.trust_score.toFixed(2)})
Applies: ${m.applies_when}
Content: ${m.content}
---`).join("\n")}

## Conflicting / Low-Trust Views (${lowTrust.length})
${lowTrust.map(m => `**${m.id}** (trust: ${m.trust_score.toFixed(2)})
Applies: ${m.applies_when}
Content: ${m.content}
---`).join("\n")}

---
**Synthesis Instructions:**
1. Identify consensus among high-trust sources
2. Note any contradictions with low-trust sources
3. Provide a clear, actionable answer to the question
4. Cite memory IDs for each claim
5. Flag any gaps where more memories are needed`;

    return {
      messages: [{ role: "user" as const, content: { type: "text" as const, text: prompt } }],
    };
  });
}