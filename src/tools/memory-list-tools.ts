import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MemoryListToolsOutputSchema } from "../output-schemas.js";

const TOOLS = [
  { name: "memory_search", description: "Search memories by query, scope, trust level, and tags" },
  { name: "memory_get", description: "Retrieve a single memory by ID" },
  { name: "memory_write", description: "Create a new memory (requires applies_when)" },
  { name: "memory_update", description: "Update an existing memory's content, trust score, tags, or status" },
  { name: "memory_delete", description: "Soft delete (archive) or hard delete a memory" },
  { name: "memory_synthesize", description: "Combine multiple memories into a synthesized answer for a question" },
  { name: "memory_wakeup", description: "Session-start digest with high-trust memories, recent activity, and protocol reminder" },
  { name: "memory_stats", description: "Project and global memory statistics with trust distribution and top tags" },
  { name: "memory_tune", description: "Adjust trust score thresholds and relabel memories" },
  { name: "memory_invalidate", description: "Mark a memory as superseded by another with a reason" },
  { name: "memory_merge", description: "Merge multiple memories into a new one, superseding the originals" },
  { name: "memory_set_status", description: "Change a memory's status (active/archived/superseded)" },
  { name: "memory_list_tools", description: "List all available memory tools" },
  { name: "health_check", description: "Check server and database connectivity" },
];

export function registerMemoryListTools(server: McpServer): void {
  server.registerTool("memory_list_tools", {
    title: "List Tools",
    description: "List all available memory tools",
    inputSchema: {},
    outputSchema: MemoryListToolsOutputSchema,
  }, async () => {
    const result = { tools: TOOLS };
    return {
      structuredContent: result,
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });
}