import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HealthCheckOutputSchema } from "../output-schemas.js";
import { getDatabase } from "../db/registry.js";

export function registerHealthCheck(server: McpServer): void {
  server.registerTool("health_check", {
    title: "Health Check",
    description: "Check server and database connectivity",
    inputSchema: {},
    outputSchema: HealthCheckOutputSchema,
  }, async () => {
    try {
      const db = getDatabase();
      const count = db.prepare("SELECT COUNT(*) as c FROM memories").get() as { c: number };
      const result = {
        status: "healthy" as const,
        database: "connected" as const,
        memoryCount: count.c,
        uptime: process.uptime(),
      };
      return {
        structuredContent: result,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch {
      const result = {
        status: "unhealthy" as const,
        database: "disconnected" as const,
        memoryCount: 0,
        uptime: process.uptime(),
      };
      return {
        isError: true,
        structuredContent: result,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  });
}