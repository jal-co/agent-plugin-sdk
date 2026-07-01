import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defineCommand,
  defineHook,
  definePlugin,
  defineSkill,
  installSkills,
  uninstallPlugin,
} from "../src/index.js";

let cwd: string;
let prev: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "aps-uninstall-"));
  prev = process.cwd();
  process.chdir(cwd);
});

afterEach(() => {
  process.chdir(prev);
  rmSync(cwd, { recursive: true, force: true });
});

describe("uninstallPlugin", () => {
  it("round-trips skill and command files and removes the manifest entry", () => {
    const plugin = definePlugin({
      id: "rich",
      description: "d",
      skills: [defineSkill({ name: "diff-review", description: "x", instructions: "do x" })],
      commands: [defineCommand({ name: "annotate", description: "x", body: "do it" })],
    });

    installSkills(plugin, { targets: ["claude"], scope: "project" });
    const skill = join(cwd, ".claude", "skills", "diff-review", "SKILL.md");
    const command = join(cwd, ".claude", "commands", "annotate.md");
    expect(existsSync(skill)).toBe(true);
    expect(existsSync(command)).toBe(true);
    expect(existsSync(join(cwd, ".ap-sdk", "install-manifest.json"))).toBe(true);

    uninstallPlugin("rich", { scope: "project" });

    expect(existsSync(skill)).toBe(false);
    expect(existsSync(command)).toBe(false);
    expect(existsSync(join(cwd, ".claude", "skills", "diff-review"))).toBe(false);
    expect(existsSync(join(cwd, ".ap-sdk", "install-manifest.json"))).toBe(false);
  });

  it("removes only its context block", () => {
    writeFileSync(join(cwd, "CLAUDE.md"), "# User notes\nKeep this.\n");
    installSkills(
      definePlugin({ id: "ctx", description: "d", instructions: "plugin instructions" }),
      { targets: ["claude"], scope: "project" },
    );

    uninstallPlugin("ctx");

    const content = readFileSync(join(cwd, "CLAUDE.md"), "utf8");
    expect(content).toContain("Keep this.");
    expect(content).not.toContain("agent-plugin-sdk:ctx");
    expect(content).not.toContain("plugin instructions");
  });

  it("removes only its MCP servers from merged JSON", () => {
    writeFileSync(
      join(cwd, "opencode.json"),
      JSON.stringify({ theme: "dark", mcp: { foreign: { type: "local", command: ["foo"] } } }),
    );
    installSkills(
      definePlugin({
        id: "mcp-plugin",
        description: "d",
        mcpServers: { mine: { command: "npx", args: ["-y", "mine"] } },
      }),
      { targets: ["opencode"], scope: "project" },
    );

    uninstallPlugin("mcp-plugin");

    const cfg = JSON.parse(readFileSync(join(cwd, "opencode.json"), "utf8"));
    expect(cfg.theme).toBe("dark");
    expect(cfg.mcp.foreign).toBeDefined();
    expect(cfg.mcp.mine).toBeUndefined();
  });

  it("removes only its hook groups", () => {
    mkdirSync(join(cwd, ".claude"), { recursive: true });
    writeFileSync(
      join(cwd, ".claude", "settings.json"),
      JSON.stringify({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "foreign" }] }] } }),
    );
    installSkills(
      definePlugin({
        id: "hook-plugin",
        description: "d",
        hooks: [
          defineHook({
            event: "pre-tool-use",
            matcher: "Bash",
            command: "echo plugin",
          }),
        ],
      }),
      { targets: ["claude"], scope: "project" },
    );

    uninstallPlugin("hook-plugin");

    const cfg = JSON.parse(readFileSync(join(cwd, ".claude", "settings.json"), "utf8"));
    expect(cfg.hooks.PreToolUse).toEqual([
      { matcher: "Bash", hooks: [{ type: "command", command: "foreign" }] },
    ]);
  });

  it("dry-run reports paths without removing files", () => {
    const plugin = definePlugin({
      id: "dry",
      description: "d",
      skills: [defineSkill({ name: "skill", description: "x", instructions: "do x" })],
    });
    installSkills(plugin, { targets: ["claude"] });
    const skill = join(".claude", "skills", "skill", "SKILL.md");

    const removed = uninstallPlugin("dry", { dryRun: true });

    expect(removed[0]?.files).toContain(skill);
    expect(existsSync(skill)).toBe(true);
    expect(existsSync(join(cwd, ".ap-sdk", "install-manifest.json"))).toBe(true);
  });

  it("throws for an unknown plugin id", () => {
    installSkills(definePlugin({ id: "known", description: "d" }), { targets: ["claude"] });
    expect(() => uninstallPlugin("missing")).toThrow(/missing/);
  });

  it("skips recorded files already deleted by the user", () => {
    const plugin = definePlugin({
      id: "gone",
      description: "d",
      skills: [defineSkill({ name: "skill", description: "x", instructions: "do x" })],
    });
    installSkills(plugin, { targets: ["claude"] });
    const skill = join(cwd, ".claude", "skills", "skill", "SKILL.md");
    rmSync(skill);

    const removed = uninstallPlugin("gone");

    expect(removed[0]?.note).toMatch(/missing/);
  });
});
