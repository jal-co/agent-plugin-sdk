import { describe, expect, it } from "vitest";
import { build } from "../src/index.js";
import type { HarnessId } from "../src/index.js";
import plugin from "../examples/planreview/plugin.js";

/** The full-feature example must keep generating a complete set per harness. */
const EXPECTED: Record<HarnessId, string[]> = {
  claude: [
    ".claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    "CLAUDE.md",
    "skills/diff-review/SKILL.md",
    "commands/planreview-annotate.md",
    "agents/pr-reviewer.md",
    "hooks/hooks.json",
    "mcp/server.ts",
    ".mcp.json",
  ],
  codex: [
    ".codex-plugin/plugin.json",
    "AGENTS.md",
    "skills/diff-review/SKILL.md",
    "prompts/planreview-annotate.md",
    "agents/pr-reviewer.toml",
    "hooks/hooks.json",
    "mcp/server.ts",
    ".mcp.json",
  ],
  pi: [
    "package.json",
    "AGENTS.md",
    "skills/diff-review/SKILL.md",
    "prompts/planreview-annotate.md",
    "extension.ts",
  ],
  opencode: [
    "AGENTS.md",
    "skills/diff-review/SKILL.md",
    "commands/planreview-annotate.md",
    "agents/pr-reviewer.md",
    "plugin.ts",
    "opencode.json",
  ],
  gemini: [
    "gemini-extension.json",
    "GEMINI.md",
    "skills/diff-review/SKILL.md",
    "commands/planreview-annotate.toml",
    "agents/pr-reviewer.md",
    "hooks/hooks.json",
    "mcp/server.ts",
  ],
  copilot: [
    ".github/copilot-instructions.md",
    ".github/skills/diff-review/SKILL.md",
    ".github/prompts/planreview-annotate.prompt.md",
    ".github/agents/pr-reviewer.agent.md",
    ".github/copilot/hooks.json",
    ".vscode/mcp.json",
    "mcp/server.ts",
  ],
  cursor: [
    "AGENTS.md",
    ".cursor/commands/planreview-annotate.md",
    ".cursor/mcp.json",
    "mcp/server.ts",
  ],
  windsurf: [
    "AGENTS.md",
    ".windsurf/skills/diff-review/SKILL.md",
    ".windsurf/workflows/planreview-annotate.md",
    "mcp_config.json",
    "mcp/server.ts",
  ],
};

describe("planreview example generates a full set for every harness", () => {
  const builds = build(plugin);

  for (const [harness, expected] of Object.entries(EXPECTED) as [
    HarnessId,
    string[],
  ][]) {
    it(`${harness}: emits all expected artifacts`, () => {
      const paths = new Set(
        builds.find((b) => b.harness === harness)!.files.map((f) => f.path),
      );
      for (const p of expected) expect(paths, `${harness} missing ${p}`).toContain(p);
    });
  }

  it("never writes a *_NOTE.md into any artifact tree", () => {
    for (const b of builds) {
      const notes = b.files.filter((f) => f.path.endsWith("_NOTE.md"));
      expect(notes, `${b.harness} leaked NOTE files`).toEqual([]);
    }
  });

  it("surfaces capability gaps as structured warnings, not files", () => {
    const pi = builds.find((b) => b.harness === "pi")!;
    const piGaps = new Set(
      pi.warnings
        .filter((w) => w.type === "unsupported-feature")
        .map((w) => (w.type === "unsupported-feature" ? w.feature : "")),
    );
    expect(piGaps).toEqual(new Set(["subagents", "hooks", "mcpServers"]));

    const opencode = builds.find((b) => b.harness === "opencode")!;
    expect(
      opencode.warnings.some(
        (w) => w.type === "unsupported-feature" && w.feature === "hooks",
      ),
    ).toBe(true);

    // Claude and Codex represent every feature this plugin uses → no feature gaps.
    for (const id of ["claude", "codex"] as const) {
      const b = builds.find((x) => x.harness === id)!;
      expect(
        b.warnings.some((w) => w.type === "unsupported-feature"),
      ).toBe(false);
    }
  });

  it("Pi package.json wires skills, prompts, and the tools extension", () => {
    const pi = builds.find((b) => b.harness === "pi")!;
    const pkg = JSON.parse(
      pi.files.find((f) => f.path === "package.json")!.content,
    );
    expect(pkg.pi).toEqual({
      skills: ["./skills"],
      prompts: ["./prompts"],
      extensions: ["./extension.ts"],
    });
  });
});
