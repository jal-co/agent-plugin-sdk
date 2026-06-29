import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { build, definePlugin, defineSubagent } from "../src/index.js";
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
  id: "review-kit",
  description: "Review agents.",
  subagents: [
    defineSubagent({
      name: "code-reviewer",
      description: "Reviews code for bugs. Use after writing code.",
      tools: ["Read", "Grep"],
      harness: {
        claude: { model: "opus" },
        codex: { model: "gpt-5.4-mini" },
        opencode: { model: "anthropic/claude-sonnet-4" },
      },
      prompt: "You are a meticulous reviewer.\nFlag bugs and missing tests.",
    }),
  ],
});

describe("subagent emission across harnesses", () => {
  const builds = build(plugin);

  it("Claude: agents/<name>.md with name/description/tools (comma)/model, body=prompt", () => {
    const { fm, body } = split(harness(builds, "claude").get("agents/code-reviewer.md")!);
    expect(fm.name).toBe("code-reviewer");
    expect(fm.tools).toBe("Read, Grep");
    expect(fm.model).toBe("opus");
    expect(body).toContain("meticulous reviewer");
  });

  it("Codex: agents/<name>.toml with developer_instructions and model", () => {
    const toml = harness(builds, "codex").get("agents/code-reviewer.toml")!;
    expect(toml).toContain('name = "code-reviewer"');
    expect(toml).toContain('model = "gpt-5.4-mini"');
    expect(toml).toContain("developer_instructions = \"\"\"");
    expect(toml).toContain("Flag bugs and missing tests.");
  });

  it("OpenCode: agents/<name>.md (plural) with mode subagent + provider model", () => {
    const { fm, body } = split(harness(builds, "opencode").get("agents/code-reviewer.md")!);
    expect(fm.description).toBe("Reviews code for bugs. Use after writing code.");
    expect(fm.mode).toBe("subagent");
    expect(fm.model).toBe("anthropic/claude-sonnet-4");
    expect(fm.tools).toBeUndefined(); // deprecated in OpenCode, not emitted
    expect(body).toContain("meticulous reviewer");
  });

  it("Pi: no agent artifact, an unsupported-feature warning instead", () => {
    const piBuild = builds.find((x) => x.harness === "pi")!;
    const f = harness(builds, "pi");
    expect([...f.keys()].some((k) => k.startsWith("agents/"))).toBe(false);
    const w = piBuild.warnings.find(
      (x) => x.type === "unsupported-feature" && x.feature === "subagents",
    );
    expect(w).toBeTruthy();
    expect(w?.type === "unsupported-feature" && w.items).toContain("code-reviewer");
  });
});
