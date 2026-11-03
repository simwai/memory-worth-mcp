import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMemoryReviewPrompt } from "./memory-review.js";
import { registerMemorySynthesisPrompt } from "./memory-synthesis.js";
import { registerMemoryCleanupPrompt } from "./memory-cleanup.js";
import { registerMemoryTuneGuidancePrompt } from "./memory-tune-guidance.js";

export function registerAllPrompts(server: McpServer): void {
  registerMemoryReviewPrompt(server);
  registerMemorySynthesisPrompt(server);
  registerMemoryCleanupPrompt(server);
  registerMemoryTuneGuidancePrompt(server);
}