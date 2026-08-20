import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import {
  build,
  defineCommand,
  defineSkill,
  defineSubagent,
  definePlugin,
} from "../src/index.js";
import type { HarnessBuild, OutputFile } from "../src/index.js";

function fileMap(files: OutputFile[]): Map<string, string> {
  return new Map(files.map((f) => [f.path, f.content]));
}
function harness(builds: HarnessBuild[], id: string): Map<string, string> {
  return fileMap(builds.find((x) => x.harness === id)!.files);
}
/** Parse the YAML frontmatter block of a `--- … ---` markdown doc. */
function frontmatterOf(doc: string): Record<string, unknown> {
  const m = doc.match(/^---\n([\s\S]*?)\n---/);
  return parse(m?.[1] ?? "") as Record<string, unknown>;
}

describe("frontmatter passthrough", () => {
  const plugin = definePlugin({
    id: "extra-fm",
    description: "frontmatter escape hatch",
    skills: [
      defineSkill({
        name: "review",
        description: "Review code.",
        instructions: "Do the review.",
        frontmatter: { effort: "high", stage: { routes: ["code"] } },
      }),
    ],
    subagents: [
      defineSubagent({
        name: "triage",
        description: "Triage the task.",
        prompt: "Triage it.",
        frontmatter: { effort: "medium", color: "blue" },
      }),
    ],
    commands: [
      defineCommand({
        name: "run",
        description: "Run it.",
        body: "Run $ARGUMENTS.",
        frontmatter: { effort: "low", category: "ops" },
      }),
    ],
  });
  const builds = build(plugin);

  it("merges extra fields into a skill's SKILL.md frontmatter", () => {
    const fm = frontmatterOf(
      harness(builds, "claude").get("skills/review/SKILL.md")!,
    );
    expect(fm.name).toBe("review"); // known fields preserved
    expect(fm.effort).toBe("high");
    expect(fm.stage).toEqual({ routes: ["code"] });
  });

  it("merges extra fields into a subagent's YAML frontmatter", () => {
    const fm = frontmatterOf(harness(builds, "claude").get("agents/triage.md")!);
    expect(fm.name).toBe("triage");
    expect(fm.effort).toBe("medium");
    expect(fm.color).toBe("blue");
  });

  it("warns instead of silently dropping it on Codex (TOML agents)", () => {
    const codex = builds.find((b) => b.harness === "codex")!;
    expect(
      codex.warnings.find(
        (w) => w.type === "unsupported-option" && w.option === "frontmatter",
      ),
    ).toMatchObject({
      harness: "codex",
      feature: "subagents",
      option: "frontmatter",
      items: ["triage"],
    });
    // Still degrades, never breaks: the agent file is emitted, minus the extras.
    const toml = fileMap(codex.files).get("agents/triage.toml")!;
    expect(toml).toContain('name = "triage"');
    expect(toml).not.toContain("color");
  });

  it("stays quiet on Codex when a subagent has no passthrough", () => {
    const p = definePlugin({
      id: "no-extras",
      description: "x",
      subagents: [
        defineSubagent({ name: "plain", description: "d", prompt: "p" }),
      ],
    });
    const codex = build(p).find((b) => b.harness === "codex")!;
    expect(codex.warnings).toEqual([]);
  });

  it("merges extra fields into a command's YAML frontmatter", () => {
    for (const [id, path] of [
      ["claude", "commands/run.md"],
      ["codex", "prompts/run.md"],
      ["opencode", "commands/run.md"],
      ["copilot", ".github/prompts/run.prompt.md"],
      ["windsurf", ".windsurf/workflows/run.md"],
    ] as const) {
      const fm = frontmatterOf(harness(builds, id).get(path)!);
      expect(fm.effort, id).toBe("low");
      expect(fm.category, id).toBe("ops");
    }
  });

  it("never lets passthrough clobber a known field", () => {
    const p = definePlugin({
      id: "clobber",
      description: "x",
      skills: [
        defineSkill({
          name: "real-name",
          description: "d",
          instructions: "i",
          frontmatter: { name: "hacked" },
        }),
      ],
    });
    const fm = frontmatterOf(
      harness(build(p), "claude").get("skills/real-name/SKILL.md")!,
    );
    expect(fm.name).toBe("real-name");
  });
});
