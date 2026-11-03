import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDatabase } from "../db/registry.js";

export function registerMemoryReviewPrompt(server: McpServer): void {
  server.registerPrompt("memory-review", {
    title: "Memory Review Prompt",
    description: "Generate a structured prompt for reviewing project memories",
    argsSchema: {
      project: z.string().min(1),
      focus: z.enum(["bugs", "architecture", "performance", "all"]).optional(),
    },
  }, async ({ project, focus = "all" }) => {
    const db = getDatabase();
    const memories = db.prepare(`
      SELECT * FROM memories WHERE project = ? AND status = 'active'
      ORDER BY trust_score DESC, updated_at DESC
    `).all(project) as any[];

    const highTrust = memories.filter(m => m.trust_label === "high");
    const unproven = memories.filter(m => m.trust_label === "unproven");
    const lowTrust = memories.filter(m => m.trust_label === "low");

    let focusFilter = memories;
    if (focus === "bugs") {
      focusFilter = memories.filter(m => m.tags && JSON.parse(m.tags).includes("bug"));
    } else if (focus === "architecture") {
      focusFilter = memories.filter(m => m.tags && (JSON.parse(m.tags).includes("architecture") || JSON.parse(m.tags).includes("design")));
    } else if (focus === "performance") {
      focusFilter = memories.filter(m => m.tags && JSON.parse(m.tags).includes("performance"));
    }

    const prompt = `Review the following memories for project "${project}" (focus: ${focus}):

## High-Trust Memories (${highTrust.length})
${highTrust.slice(0, 10).map(m => `- **${m.id}** (trust: ${m.trust_score.toFixed(2)}) ${m.content.slice(0, 200)}... [applies: ${m.applies_when}]`).join("\n")}

## Unproven Memories Needing Review (${unproven.length})
${unproven.slice(0, 10).map(m => `- **${m.id}** ${m.content.slice(0, 200)}... [applies: ${m.applies_when}]`).join("\n")}

## Low-Trust Memories (${lowTrust.length})
${lowTrust.slice(0, 5).map(m => `- **${m.id}** (trust: ${m.trust_score.toFixed(2)}) ${m.content.slice(0, 200)}... [applies: ${m.applies_when}]`).join("\n")}

## Focus: ${focus} (${focusFilter.length} memories)
${focusFilter.slice(0, 10).map(m => `- **${m.id}** [${m.trust_label}] ${m.content.slice(0, 200)}...`).join("\n")}

---
**Review Tasks:**
1. Validate high-trust memories still apply
2. Calibrate unproven memories (mark success/failure)
3. Archive or invalidate low-trust memories
4. Merge related memories
5. Update tags for discoverability`;

    return {
      messages: [{ role: "user" as const, content: { type: "text" as const, text: prompt } }],
    };
  });
}