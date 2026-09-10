import { describe, expect, it } from "vitest";
import {
  build,
  defineCommand,
  defineHook,
  definePlugin,
  defineSkill,
  defineSubagent,
} from "../src/index.js";
import type { BuildWarning, HarnessBuild, OutputFile } from "../src/index.js";

function fileMap(files: OutputFile[]): Map<string, string> {
  return new Map(files.map((f) => [f.path, f.content]));
}
function optionWarnings(builds: HarnessBuild[], id: string): BuildWarning[] {
  return builds
    .find((x) => x.harness === id)!
    .warnings.filter((w) => w.type === "unsupported-option");
}
function pairs(warnings: BuildWarning[]): string[] {
  return warnings
    .map((w) => (w.type === "unsupported-option" ? `${w.feature}.${w.option}` : ""))
    .sort();
}

describe("unsupported-option warnings for dropped fields", () => {
  // Every optional portable field is set, the honored ones included, so a
  // spurious warning on an honored field fails a row below.
  const sink = definePlugin({
    id: "sink",
    description: "every optional field set",
    skills: [
      defineSkill({
        name: "triage",
        description: "Triage the task.",
        instructions: "Triage it.",
        allowedTools: ["Read"],
        disableModelInvocation: true,
        license: "MIT",
        metadata: { team: "docs" },
        frontmatter: { extra: "field" },
      }),
    ],
    commands: [
      defineCommand({
        name: "ship",
        description: "Ship it.",
        body: "Ship the change.",
        argumentHint: "[target]",
        allowedTools: ["Read"],
        frontmatter: { extra: "field" },
      }),
    ],
    subagents: [
      defineSubagent({
        name: "helper",
        description: "Help with the task.",
        prompt: "Help.",
        tools: ["Read"],
        frontmatter: { color: "blue" },
      }),
    ],
    hooks: [
      defineHook({
        event: "pre-tool-use",
        matcher: "Bash",
        async: true,
        command: { bash: "check.sh", powershell: "check.ps1" },
      }),
    ],
  });
  const builds = build(sink);

  // The per-harness contract: exactly these `feature.option` pairs, no more.
  const EXPECTED: Record<string, string[]> = {
    claude: ["hooks.powershell"],
    codex: [
      "commands.allowedTools",
      "hooks.async",
      "hooks.powershell",
      "skills.allowedTools",
      "skills.disableModelInvocation",
      "skills.license",
      "subagents.frontmatter",
      "subagents.tools",
    ],
    pi: ["commands.allowedTools"],
    opencode: [
      "commands.allowedTools",
      "commands.argumentHint",
      "skills.allowedTools",
      "skills.disableModelInvocation",
      "subagents.tools",
    ],
    copilot: [
      "hooks.async",
      "hooks.matcher",
      "skills.allowedTools",
      "skills.license",
      "skills.metadata",
    ],
    gemini: [
      "commands.allowedTools",
      "commands.argumentHint",
      "commands.frontmatter",
      "hooks.async",
      "hooks.powershell",
      "skills.allowedTools",
      "skills.disableModelInvocation",
      "skills.license",
      "skills.metadata",
    ],
    cursor: [
      "commands.allowedTools",
      "commands.argumentHint",
      "commands.frontmatter",
    ],
    windsurf: [
      "commands.allowedTools",
      "commands.argumentHint",
      "skills.allowedTools",
      "skills.disableModelInvocation",
      "skills.license",
      "skills.metadata",
    ],
  };

  it("pins a contract for every harness build() returns", () => {
    expect(builds.map((b) => b.harness).sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );
  });

  for (const [id, expected] of Object.entries(EXPECTED)) {
    it(`${id}: warns for exactly the fields it drops`, () => {
      expect(pairs(optionWarnings(builds, id))).toEqual(expected);
    });
  }

  it("names the item and the reason in each warning", () => {
    const w = optionWarnings(builds, "codex").find(
      (x) => x.type === "unsupported-option" && x.option === "allowedTools" && x.feature === "skills",
    );
    expect(w).toMatchObject({
      type: "unsupported-option",
      harness: "codex",
      feature: "skills",
      option: "allowedTools",
      items: ["triage"],
    });
    expect((w as { details: string }).details).toContain("frontmatter");
  });

  it("still degrades, never breaks: the files are emitted minus the fields", () => {
    const codex = fileMap(builds.find((b) => b.harness === "codex")!.files);
    const skillDoc = codex.get("skills/triage/SKILL.md")!;
    expect(skillDoc).toContain("name:");
    expect(skillDoc).not.toContain("allowed-tools");
    expect(skillDoc).not.toContain("license");
    const cursor = fileMap(builds.find((b) => b.harness === "cursor")!.files);
    expect(cursor.get(".cursor/commands/ship.md")).toBe("Ship the change.\n");
    // Copilot honors the variant natively, so it must emit, not warn.
    const copilot = fileMap(builds.find((b) => b.harness === "copilot")!.files);
    const hooksJson = JSON.parse(copilot.get(".github/copilot/hooks.json")!) as {
      hooks: { PreToolUse: Array<Record<string, unknown>> };
    };
    expect(hooksJson.hooks.PreToolUse[0]).toMatchObject({
      command: "check.sh",
      windows: "check.ps1",
    });
  });

  it("treats empty values as unset and warns nothing", () => {
    const empty = definePlugin({
      id: "empty",
      description: "optional fields set to empty values",
      skills: [
        defineSkill({
          name: "s",
          description: "d",
          instructions: "i",
          allowedTools: [],
          disableModelInvocation: false,
          metadata: {},
        }),
      ],
      commands: [
        defineCommand({
          name: "c",
          description: "d",
          body: "b",
          allowedTools: [],
          frontmatter: {},
        }),
      ],
      subagents: [
        defineSubagent({
          name: "a",
          description: "d",
          prompt: "p",
          tools: [],
          frontmatter: {},
        }),
      ],
    });
    for (const b of build(empty)) {
      expect(
        b.warnings.filter((w) => w.type === "unsupported-option"),
      ).toEqual([]);
    }
  });

  it("stays quiet when no optional field is set", () => {
    const bare = definePlugin({
      id: "bare",
      description: "required fields only",
      skills: [
        defineSkill({ name: "s", description: "d", instructions: "i" }),
      ],
      commands: [defineCommand({ name: "c", description: "d", body: "b" })],
      subagents: [
        defineSubagent({ name: "a", description: "d", prompt: "p" }),
      ],
      hooks: [
        defineHook({ event: "pre-tool-use", command: { bash: "check.sh" } }),
      ],
    });
    for (const b of build(bare)) {
      expect(
        b.warnings.filter((w) => w.type === "unsupported-option"),
      ).toEqual([]);
    }
  });
});
