import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defineCommand,
  definePlugin,
  defineSkill,
  installSkills,
} from "../src/index.js";

const plugin = definePlugin({
  id: "tools-plugin",
  description: "MCP install test.",
  mcpServers: {
    "new-server": { command: "npx", args: ["-y", "@acme/mcp"] },
  },
});

let cwd: string;
let prev: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "aps-install-"));
  prev = process.cwd();
  process.chdir(cwd);
});
afterEach(() => {
  process.chdir(prev);
  rmSync(cwd, { recursive: true, force: true });
});

describe("MCP install (JSON merge)", () => {
  it("OpenCode: merges into existing opencode.json without clobbering other keys", () => {
    writeFileSync(
      join(cwd, "opencode.json"),
      JSON.stringify({
        $schema: "https://opencode.ai/config.json",
        theme: "dark",
        mcp: { "existing-server": { type: "local", command: ["foo"] } },
      }),
    );

    installSkills(plugin, { targets: ["opencode"], scope: "project" });

    const cfg = JSON.parse(readFileSync(join(cwd, "opencode.json"), "utf8"));
    expect(cfg.theme).toBe("dark"); // untouched
    expect(cfg.mcp["existing-server"]).toBeDefined(); // preserved
    expect(cfg.mcp["new-server"]).toEqual({
      type: "local",
      command: ["npx", "-y", "@acme/mcp"],
      enabled: true,
    });
  });

  it("Claude: creates .mcp.json when absent", () => {
    installSkills(plugin, { targets: ["claude"], scope: "project" });
    const cfg = JSON.parse(readFileSync(join(cwd, ".mcp.json"), "utf8"));
    expect(cfg.mcpServers["new-server"]).toEqual({
      command: "npx",
      args: ["-y", "@acme/mcp"],
    });
  });

  it("is idempotent — installing twice yields the same file", () => {
    installSkills(plugin, { targets: ["claude"], scope: "project" });
    const once = readFileSync(join(cwd, ".mcp.json"), "utf8");
    installSkills(plugin, { targets: ["claude"], scope: "project" });
    const twice = readFileSync(join(cwd, ".mcp.json"), "utf8");
    expect(twice).toBe(once);
  });

  it("refuses to clobber a non-JSON config file", () => {
    writeFileSync(join(cwd, "opencode.json"), "{ this is not json");
    expect(() =>
      installSkills(plugin, { targets: ["opencode"], scope: "project" }),
    ).toThrow(/not valid JSON/);
  });

  it("Codex & Pi: MCP is not installed standalone (returns a note, no files)", () => {
    const res = installSkills(plugin, { targets: ["codex", "pi"] });
    const mcpItems = res.filter((r) => r.kind === "mcp");
    expect(mcpItems).toHaveLength(2);
    for (const item of mcpItems) {
      expect(item.files).toHaveLength(0);
      expect(item.note).toBeTruthy();
    }
  });
});

describe("skill/command relocation across non-standard harness layouts", () => {
  const rich = definePlugin({
    id: "rich",
    description: "d",
    skills: [
      defineSkill({
        name: "diff-review",
        description: "x",
        instructions: "do x",
      }),
    ],
    commands: [
      defineCommand({ name: "annotate", description: "x", body: "do it" }),
    ],
  });

  it("Gemini: relocates the .toml command and the skill dir", () => {
    const res = installSkills(rich, { targets: ["gemini"], scope: "project" });
    const cmd = res.find((r) => r.kind === "command")!;
    expect(cmd.files[0]).toBe(join(".gemini", "commands", "annotate.toml"));
    expect(existsSync(cmd.files[0]!)).toBe(true);
    const skill = res.find((r) => r.kind === "skill")!;
    expect(skill.files[0]).toBe(
      join(".gemini", "skills", "diff-review", "SKILL.md"),
    );
    expect(existsSync(skill.files[0]!)).toBe(true);
  });

  it("Copilot: relocates the .prompt.md command and .github/skills skill", () => {
    const res = installSkills(rich, { targets: ["copilot"], scope: "project" });
    const cmd = res.find((r) => r.kind === "command")!;
    expect(cmd.files[0]).toBe(
      join(".github", "prompts", "annotate.prompt.md"),
    );
    expect(existsSync(cmd.files[0]!)).toBe(true);
    const skill = res.find((r) => r.kind === "skill")!;
    expect(skill.files[0]).toBe(
      join(".github", "skills", "diff-review", "SKILL.md"),
    );
    expect(existsSync(skill.files[0]!)).toBe(true);
  });
});
