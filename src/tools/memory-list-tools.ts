import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";

const ListToolsSchema = z.object({});
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
];

export function registerMemoryListTools(server: Server): void {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "memory_list_tools") {
      return { content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }], isError: true };
    }

    const rawArgs = request.params.arguments as Record<string, unknown> | undefined;
    const parsed = ListToolsSchema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      return { content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }], isError: true };
    }

    return { content: [{ type: "text", text: JSON.stringify(TOOLS, null, 2) }], isError: false };
  });
}