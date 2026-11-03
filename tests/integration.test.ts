import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { initializeDatabase } from "../src/db/index.js";
import { setDatabase } from "../src/db/registry.js";
import { createServer } from "../src/server.js";
import type { Database as DatabaseType } from "better-sqlite3";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

let client: Client;
let server: McpServer;
let db: DatabaseType;
let tempDir: string;

beforeAll(async () => {
  // File-backed DB in an isolated temp directory (not the real memory.db).
  tempDir = mkdtempSync(join(tmpdir(), "memory-worth-test-"));
  db = initializeDatabase(join(tempDir, "memory.db"));
  setDatabase(db);
  client = new Client({ name: "test-client", version: "1.0.0" });
  server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
});

afterAll(async () => {
  await client.close();
  db.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("MCP integration (in-memory transport)", () => {
  it("registers 14 tools", async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(14);
  });

  it("registers the 4 resource templates", async () => {
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.map(t => t.uriTemplate).sort()).toEqual([
      "memory://project/{project}/export",
      "memory://project/{project}/memories",
      "memory://project/{project}/memories/{id}",
      "memory://project/{project}/stats",
    ]);
  });

  it("registers the global fixed resource", async () => {
    const { resources } = await client.listResources();
    expect(resources.map(r => r.uri)).toContain("memory://global/memories");
  });

  it("writes a memory and exposes it through templated resources", async () => {
    const written = await client.callTool({
      name: "memory_write",
      arguments: {
        project: "it-proj",
        content: "Use fixed timestep in src/loop.ts:10",
        appliesWhen: "src/loop.ts:10",
        tags: ["architecture"],
      },
    });
    expect((written as { structuredContent?: { id: string } }).structuredContent?.id).toBeTruthy();
    expect((written as { structuredContent?: { trustLabel: string } }).structuredContent?.trustLabel).toBe("unproven");

    // memory-list template: project appears with the memory
    const list = await client.readResource({ uri: "memory://project/it-proj/memories" });
    const listBody = JSON.parse(list.contents[0].text as string);
    expect(listBody.count).toBe(1);
    expect(listBody.memories[0].content).toContain("fixed timestep");

    // memory-get template: single memory by id
    const id = listBody.memories[0].id;
    const single = await client.readResource({ uri: `memory://project/it-proj/memories/${id}` });
    const singleBody = JSON.parse(single.contents[0].text as string);
    expect(singleBody.id).toBe(id);

    // memory-export template: full export
    const exported = await client.readResource({ uri: "memory://project/it-proj/export" });
    expect(JSON.parse(exported.contents[0].text as string)).toHaveLength(1);

    // memory-stats template
    const stats = await client.readResource({ uri: "memory://project/it-proj/stats" });
    const statsBody = JSON.parse(stats.contents[0].text as string);
    expect(statsBody.projectStats.total).toBe(1);

    // global resource stays at 0 (project-scoped write)
    const global = await client.readResource({ uri: "memory://global/memories" });
    expect(JSON.parse(global.contents[0].text as string).count).toBe(0);
  });

  it("rejects reading a missing memory through the template", async () => {
    await expect(
      client.readResource({ uri: "memory://project/it-proj/memories/missing-id" })
    ).rejects.toThrow();
  });

  it("searches memories via tools/call with structured output", async () => {
    const result = await client.callTool({
      name: "memory_search",
      arguments: { query: "timestep", scope: "project", project: "it-proj" },
    });
    const structured = (result as { structuredContent?: { count: number; memories: unknown[] } }).structuredContent;
    expect(structured?.count).toBe(1);
  });

  it("lists 4 prompts and renders memory-review", async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map(p => p.name).sort()).toEqual([
      "memory-cleanup",
      "memory-review",
      "memory-synthesis",
      "memory-tune-guidance",
    ]);

    const rendered = await client.getPrompt({ name: "memory-review", arguments: { project: "it-proj" } });
    expect(rendered.messages[0].role).toBe("user");
    expect((rendered.messages[0].content as { text: string }).text).toContain("it-proj");
  });
});
