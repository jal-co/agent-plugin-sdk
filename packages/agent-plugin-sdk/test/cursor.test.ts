import { describe, expect, it } from "vitest";
import {
  build,
  defineCommand,
  definePlugin,
  defineSkill,
  defineSubagent,
} from "../src/index.js";

function cursorFiles(plugin: Parameters<typeof build>[0]) {
  const [out] = build(plugin, { targets: ["cursor"] });
  const map = new Map(out!.files.map((f) => [f.path, f.content]));
  return { out: out!, get: (p: string) => map.get(p), map };
}

describe("Cursor harness", () => {
  it("emits instructions to AGENTS.md", () => {
    const { get } = cursorFiles(
      definePlugin({
        id: "demo",
        description: "d",
        instructions: "Use TypeScript everywhere.",
      }),
    );
    expect(get("AGENTS.md")).toContain("Use TypeScript everywhere.");
  });

  it("emits commands as plain markdown under .cursor/commands", () => {
    const { get } = cursorFiles(
      definePlugin({
        id: "demo",
        description: "d",
        commands: [
          defineCommand({
            name: "ship",
            description: "Ship it.",
            body: "Run the release checklist.",
          }),
        ],
      }),
    );
    expect(get(".cursor/commands/ship.md")).toBe("Run the release checklist.\n");
  });

  it("emits MCP to .cursor/mcp.json under mcpServers", () => {
    const { get } = cursorFiles(
      definePlugin({
        id: "demo",
        description: "d",
        mcpServers: {
          github: { command: "npx", args: ["srv"], env: { T: "1" } },
          api: { transport: "http", url: "https://x.test/mcp", headers: { A: "b" } },
        },
      }),
    );
    const mcp = JSON.parse(get(".cursor/mcp.json")!);
    expect(mcp.mcpServers.github).toEqual({
      command: "npx",
      args: ["srv"],
      env: { T: "1" },
    });
    // Remote is url + headers (no `type`).
    expect(mcp.mcpServers.api).toEqual({
      url: "https://x.test/mcp",
      headers: { A: "b" },
    });
  });

  it("bundles custom tools as an MCP server", () => {
    const { get } = cursorFiles(
      definePlugin({
        id: "demo",
        description: "d",
        tools: { module: "./tools.ts" },
      }),
    );
    const mcp = JSON.parse(get(".cursor/mcp.json")!);
    expect(mcp.mcpServers["demo-tools"].args).toContain(
      "${workspaceFolder}/mcp/server.ts",
    );
  });

  it("warns (never throws or writes) on skills/subagents/hooks it can't represent", () => {
    const { out, map } = cursorFiles(
      definePlugin({
        id: "demo",
        description: "d",
        skills: [
          defineSkill({ name: "s", description: "x", instructions: "do x" }),
        ],
        subagents: [
          defineSubagent({ name: "a", description: "x", prompt: "be x" }),
        ],
        hooks: [{ event: "stop", command: "echo done" }],
      }),
    );
    const gaps = new Set(
      out.warnings
        .filter((w) => w.type === "unsupported-feature")
        .map((w) => (w.type === "unsupported-feature" ? w.feature : "")),
    );
    expect(gaps).toEqual(new Set(["skills", "subagents", "hooks"]));
    // Nothing for those features was written into the tree.
    expect([...map.keys()].some((p) => p.includes("skills/"))).toBe(false);
    expect([...map.keys()].some((p) => p.includes("agents/"))).toBe(false);
  });
});
