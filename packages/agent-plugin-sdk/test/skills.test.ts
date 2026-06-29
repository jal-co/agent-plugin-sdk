import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { build, definePlugin, defineSkill } from "../src/index.js";
import type { HarnessBuild, OutputFile } from "../src/index.js";

function fileMap(files: OutputFile[]): Map<string, string> {
  return new Map(files.map((f) => [f.path, f.content]));
}

function harness(builds: HarnessBuild[], id: string): Map<string, string> {
  const b = builds.find((x) => x.harness === id);
  if (!b) throw new Error(`no build for ${id}`);
  return fileMap(b.files);
}

/** Pull the YAML frontmatter out of a SKILL.md string. */
function frontmatter(skillMd: string): Record<string, unknown> {
  const m = skillMd.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error(`no frontmatter in:\n${skillMd}`);
  return parse(m[1]!);
}

const plugin = definePlugin({
  id: "git-helper",
  version: "1.2.3",
  description: "Skills for git.",
  skills: [
    defineSkill({
      name: "diff-review",
      description: "Summarize changes: with a colon, and \"quotes\" too.",
      allowedTools: ["Bash(git diff *)", "Read"],
      disableModelInvocation: true,
      metadata: { audience: "maintainers" },
      instructions: "## Body\nDo the thing.",
      resources: [
        { path: "references/style.md", content: "# Style\n" },
        { path: "scripts/run.sh", content: "#!/bin/sh\necho hi\n", executable: true },
      ],
    }),
  ],
});

describe("skill emission across harnesses", () => {
  const builds = build(plugin);

  it("targets all harnesses by default", () => {
    expect(builds.map((b) => b.harness).sort()).toEqual([
      "claude",
      "codex",
      "copilot",
      "gemini",
      "opencode",
      "pi",
    ]);
  });

  describe("Claude Code", () => {
    const f = harness(builds, "claude");
    it("emits a .claude-plugin manifest", () => {
      const manifest = JSON.parse(f.get(".claude-plugin/plugin.json")!);
      expect(manifest).toMatchObject({
        name: "git-helper",
        version: "1.2.3",
        description: "Skills for git.",
      });
    });
    it("emits SKILL.md with name, description, allowed-tools", () => {
      const fm = frontmatter(f.get("skills/diff-review/SKILL.md")!);
      expect(fm.name).toBe("diff-review");
      expect(fm.description).toContain("colon");
      expect(fm["allowed-tools"]).toBe("Bash(git diff *) Read");
    });
    it("bundles resources alongside the skill", () => {
      expect(f.get("skills/diff-review/references/style.md")).toBe("# Style\n");
      expect(f.has("skills/diff-review/scripts/run.sh")).toBe(true);
    });
  });

  describe("Codex", () => {
    const f = harness(builds, "codex");
    it("emits a .codex-plugin manifest pointing at skills", () => {
      const manifest = JSON.parse(f.get(".codex-plugin/plugin.json")!);
      expect(manifest.skills).toBe("./skills/");
    });
    it("emits minimal frontmatter (only name + description, no allowed-tools)", () => {
      const fm = frontmatter(f.get("skills/diff-review/SKILL.md")!);
      expect(Object.keys(fm).sort()).toEqual(["description", "name"]);
    });
  });

  describe("Pi", () => {
    const f = harness(builds, "pi");
    it("emits a pi-package package.json", () => {
      const pkg = JSON.parse(f.get("package.json")!);
      expect(pkg.keywords).toContain("pi-package");
      expect(pkg.pi).toEqual({ skills: ["./skills"] });
    });
    it("emits Pi-specific frontmatter fields", () => {
      const fm = frontmatter(f.get("skills/diff-review/SKILL.md")!);
      expect(fm["allowed-tools"]).toBe("Bash(git diff *) Read");
      expect(fm["disable-model-invocation"]).toBe(true);
      expect(fm.metadata).toEqual({ audience: "maintainers" });
    });
  });

  describe("OpenCode", () => {
    const f = harness(builds, "opencode");
    it("emits only recognized frontmatter fields", () => {
      const fm = frontmatter(f.get("skills/diff-review/SKILL.md")!);
      expect(fm.name).toBe("diff-review");
      expect(fm.compatibility).toBe("opencode");
      expect(fm.metadata).toEqual({ audience: "maintainers" });
      // allowed-tools / disable-model-invocation are NOT recognized here
      expect(fm["allowed-tools"]).toBeUndefined();
      expect(fm["disable-model-invocation"]).toBeUndefined();
    });
    it("requires name to equal the directory name", () => {
      const fm = frontmatter(f.get("skills/diff-review/SKILL.md")!);
      expect(fm.name).toBe("diff-review");
    });
  });

  it("emits identical skill bodies across all harnesses", () => {
    const bodies = builds.map((b) => {
      // Path prefix differs per harness (e.g. Copilot uses .github/skills/), so
      // match the SKILL.md by suffix.
      const file = b.files.find((f) =>
        f.path.endsWith("skills/diff-review/SKILL.md"),
      )!;
      return file.content.split("---\n").slice(2).join("---\n").trim();
    });
    expect(new Set(bodies).size).toBe(1);
  });
});
