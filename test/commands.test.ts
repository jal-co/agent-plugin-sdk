import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { build, definePlugin, defineCommand } from "../src/index.js";
import type { HarnessBuild, OutputFile } from "../src/index.js";

function fileMap(files: OutputFile[]): Map<string, string> {
  return new Map(files.map((f) => [f.path, f.content]));
}
function harness(builds: HarnessBuild[], id: string): Map<string, string> {
  return fileMap(builds.find((x) => x.harness === id)!.files);
}
function split(md: string): { fm: Record<string, unknown>; body: string } {
  const m = md.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);
  if (!m) throw new Error(`bad doc:\n${md}`);
  return { fm: parse(m[1]!), body: m[2]!.trimEnd() };
}

const plugin = definePlugin({
  id: "git-helper",
  description: "git helpers",
  commands: [
    defineCommand({
      name: "fix-issue",
      description: "Fix a GitHub issue.",
      argumentHint: "[issue-number]",
      allowedTools: ["Bash(gh *)"],
      harness: {
        claude: { model: "sonnet" },
        opencode: { model: "anthropic/claude-sonnet-4" },
      },
      body: "Fix issue #$1 titled \"$2\".\nUse all of: $ARGUMENTS",
    }),
  ],
});

describe("command emission across harnesses", () => {
  const builds = build(plugin);

  describe("Claude Code", () => {
    const f = harness(builds, "claude");
    const { fm, body } = split(f.get("commands/fix-issue.md")!);
    it("emits commands/<name>.md with rich frontmatter", () => {
      expect(fm.description).toBe("Fix a GitHub issue.");
      expect(fm["argument-hint"]).toBe("[issue-number]");
      expect(fm["allowed-tools"]).toBe("Bash(gh *)");
      expect(fm.model).toBe("sonnet"); // from harness.claude
    });
    it("rewrites 1-based $N to 0-based $ARGUMENTS[n-1]", () => {
      expect(body).toContain("issue #$ARGUMENTS[0]");
      expect(body).toContain('"$ARGUMENTS[1]"');
      expect(body).toContain("Use all of: $ARGUMENTS"); // $ARGUMENTS untouched
    });
  });

  describe("Codex", () => {
    const f = harness(builds, "codex");
    it("emits prompts/<name>.md (NOT inside the plugin), minimal frontmatter", () => {
      expect(f.has("prompts/fix-issue.md")).toBe(true);
      const { fm, body } = split(f.get("prompts/fix-issue.md")!);
      expect(Object.keys(fm).sort()).toEqual(["argument-hint", "description"]);
      // native 1-based, body passes through unchanged
      expect(body).toContain("issue #$1");
    });
  });

  describe("Pi", () => {
    const f = harness(builds, "pi");
    it("declares prompts/ in the package.json pi key", () => {
      const pkg = JSON.parse(f.get("package.json")!);
      expect(pkg.pi.prompts).toEqual(["./prompts"]);
      expect(pkg.pi.skills).toBeUndefined(); // no skills in this plugin
    });
    it("emits prompts/<name>.md with native 1-based body", () => {
      const { body } = split(f.get("prompts/fix-issue.md")!);
      expect(body).toContain("issue #$1");
    });
  });

  describe("OpenCode", () => {
    const f = harness(builds, "opencode");
    it("emits commands/<name>.md (plural) with description/model", () => {
      const { fm, body } = split(f.get("commands/fix-issue.md")!);
      expect(fm.description).toBe("Fix a GitHub issue.");
      expect(fm.model).toBe("anthropic/claude-sonnet-4"); // from harness.opencode
      expect(fm["allowed-tools"]).toBeUndefined(); // not an OpenCode command field
      expect(body).toContain("issue #$1");
    });
  });

  it("only Claude rewrites positional args; the other three keep 1-based", () => {
    const bodies = ["codex", "pi", "opencode"].map(
      (id) => split(harness(builds, id).get(/* commands or prompts */ findCmd(builds, id))!).body,
    );
    for (const b of bodies) expect(b).toContain("$1");
  });
});

function findCmd(builds: HarnessBuild[], id: string): string {
  return [...harness(builds, id).keys()].find((p) => p.endsWith("/fix-issue.md"))!;
}
