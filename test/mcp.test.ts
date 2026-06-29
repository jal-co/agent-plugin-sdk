import { describe, expect, it } from "vitest";
import { build, definePlugin } from "../src/index.js";
import type { HarnessBuild, OutputFile } from "../src/index.js";

function fileMap(files: OutputFile[]): Map<string, string> {
  return new Map(files.map((f) => [f.path, f.content]));
}
function harness(builds: HarnessBuild[], id: string): Map<string, string> {
  return fileMap(builds.find((x) => x.harness === id)!.files);
}

const plugin = definePlugin({
  id: "tools-plugin",
  description: "Bundles MCP servers.",
  mcpServers: {
    "local-db": {
      command: "npx",
      args: ["-y", "@acme/db-mcp"],
      env: { DB_URL: "postgres://localhost" },
    },
    "remote-api": {
      transport: "http",
      url: "https://api.example.com/mcp",
      headers: { Authorization: "Bearer xyz" },
    },
  },
});

describe("MCP emission across harnesses", () => {
  const builds = build(plugin);

  it("Claude: .mcp.json with mcpServers, type discriminator on http", () => {
    const cfg = JSON.parse(harness(builds, "claude").get(".mcp.json")!);
    expect(cfg.mcpServers["local-db"]).toEqual({
      command: "npx",
      args: ["-y", "@acme/db-mcp"],
      env: { DB_URL: "postgres://localhost" },
    });
    expect(cfg.mcpServers["remote-api"]).toEqual({
      type: "http",
      url: "https://api.example.com/mcp",
      headers: { Authorization: "Bearer xyz" },
    });
  });

  it("Codex: .mcp.json direct map (no type), http_headers, plugin.json ref", () => {
    const f = harness(builds, "codex");
    const cfg = JSON.parse(f.get(".mcp.json")!);
    expect(cfg["local-db"]).toEqual({
      command: "npx",
      args: ["-y", "@acme/db-mcp"],
      env: { DB_URL: "postgres://localhost" },
    });
    expect(cfg["remote-api"]).toEqual({
      url: "https://api.example.com/mcp",
      http_headers: { Authorization: "Bearer xyz" },
    });
    expect(cfg["remote-api"].type).toBeUndefined();
    const manifest = JSON.parse(f.get(".codex-plugin/plugin.json")!);
    expect(manifest.mcpServers).toBe("./.mcp.json");
  });

  it("OpenCode: opencode.json mcp key, command array, environment not env", () => {
    const cfg = JSON.parse(harness(builds, "opencode").get("opencode.json")!);
    expect(cfg.$schema).toBe("https://opencode.ai/config.json");
    expect(cfg.mcp["local-db"]).toEqual({
      type: "local",
      command: ["npx", "-y", "@acme/db-mcp"],
      enabled: true,
      environment: { DB_URL: "postgres://localhost" },
    });
    expect(cfg.mcp["remote-api"]).toEqual({
      type: "remote",
      url: "https://api.example.com/mcp",
      enabled: true,
      headers: { Authorization: "Bearer xyz" },
    });
  });

  it("Pi: no config (no native MCP), an unsupported-feature warning instead", () => {
    const piBuild = builds.find((x) => x.harness === "pi")!;
    const f = harness(builds, "pi");
    // never emits a config Pi would misread
    expect([...f.keys()].some((k) => k.endsWith(".json") && k !== "package.json")).toBe(false);
    const w = piBuild.warnings.find(
      (x) => x.type === "unsupported-feature" && x.feature === "mcpServers",
    );
    expect(w).toBeTruthy();
    expect(w?.type === "unsupported-feature" && w.items).toContain("local-db");
  });
});
