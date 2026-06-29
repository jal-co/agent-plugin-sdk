import { describe, expect, it } from "vitest";
import { build, definePlugin, defineHook } from "../src/index.js";
import type { HarnessBuild, OutputFile } from "../src/index.js";

function fileMap(files: OutputFile[]): Map<string, string> {
  return new Map(files.map((f) => [f.path, f.content]));
}
function harness(builds: HarnessBuild[], id: string): Map<string, string> {
  return fileMap(builds.find((x) => x.harness === id)!.files);
}

describe("hooks emission across harnesses", () => {
  const plugin = definePlugin({
    id: "hooky",
    description: "hooks test",
    hooks: [
      defineHook({
        event: "pre-tool-use",
        matcher: "EnterPlanMode",
        command: "plannotator improve-context",
        timeout: 5,
      }),
      defineHook({
        event: "stop",
        command: { bash: "plannotator", powershell: "plannotator.exe" },
        timeout: 345600,
        comment: "open review UI",
      }),
    ],
  });
  const builds = build(plugin);

  it("Claude: hooks/hooks.json with matcher-wrapped PascalCase events", () => {
    const cfg = JSON.parse(harness(builds, "claude").get("hooks/hooks.json")!);
    expect(cfg.hooks.PreToolUse[0]).toEqual({
      matcher: "EnterPlanMode",
      hooks: [{ type: "command", command: "plannotator improve-context", timeout: 5 }],
    });
    expect(cfg.hooks.Stop[0]).toEqual({
      hooks: [{ type: "command", command: "plannotator", timeout: 345600 }],
    });
  });

  it("Codex: hooks/hooks.json + a feature-flag README", () => {
    const f = harness(builds, "codex");
    const cfg = JSON.parse(f.get("hooks/hooks.json")!);
    expect(cfg.hooks.Stop[0].hooks[0].command).toBe("plannotator");
    expect(f.get("hooks/README.md")).toContain("[features]");
  });

  it("Pi & OpenCode: no hook config, an unsupported-feature warning instead", () => {
    for (const id of ["pi", "opencode"]) {
      const b = builds.find((x) => x.harness === id)!;
      const f = harness(builds, id);
      expect([...f.keys()].some((k) => k.includes("hooks.json"))).toBe(false);
      expect(
        b.warnings.some(
          (w) => w.type === "unsupported-feature" && w.feature === "hooks",
        ),
      ).toBe(true);
    }
  });
});

// The proof: reconstruct plannotator's real hook artifacts from one definition.
describe("reproduces plannotator's actual hook files", () => {
  // Authored portably: plan review wired to Claude's ExitPlanMode (PermissionRequest)
  // and Codex's Stop — the exact divergence plannotator hand-maintains.
  const plannotator = definePlugin({
    id: "plannotator",
    description: "Interactive Plan Review.",
    hooks: [
      defineHook({
        event: "pre-tool-use",
        matcher: "EnterPlanMode",
        command: "plannotator improve-context",
        timeout: 5,
      }),
      defineHook({
        event: "pre-tool-use",
        matcher: "ExitPlanMode",
        command: "plannotator",
        timeout: 345600,
        harness: { claude: { event: "PermissionRequest" }, codex: { event: "Stop", matcher: undefined } },
      }),
    ],
  });
  const builds = build(plannotator);

  it("matches apps/hook/hooks/hooks.json (Claude) exactly", () => {
    const cfg = JSON.parse(harness(builds, "claude").get("hooks/hooks.json")!);
    expect(cfg).toEqual({
      hooks: {
        PreToolUse: [
          {
            matcher: "EnterPlanMode",
            hooks: [{ type: "command", command: "plannotator improve-context", timeout: 5 }],
          },
        ],
        PermissionRequest: [
          {
            matcher: "ExitPlanMode",
            hooks: [{ type: "command", command: "plannotator", timeout: 345600 }],
          },
        ],
      },
    });
  });

  it("matches apps/codex Stop hook exactly", () => {
    const cfg = JSON.parse(harness(builds, "codex").get("hooks/hooks.json")!);
    // EnterPlanMode has no Codex meaning; plan review maps to Stop (no matcher).
    expect(cfg.hooks.Stop).toEqual([
      { hooks: [{ type: "command", command: "plannotator", timeout: 345600 }] },
    ]);
  });
});
