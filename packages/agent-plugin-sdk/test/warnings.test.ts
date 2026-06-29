import { describe, expect, it } from "vitest";
import {
  build,
  definePlugin,
  defineSubagent,
  emitFor,
  formatWarning,
  supportMatrix,
  getHarness,
} from "../src/index.js";

describe("capability matrix (declarative source of truth)", () => {
  const matrix = supportMatrix();

  it("reflects each harness's divergence from the common denominator", () => {
    // Claude is the reference harness: supports everything.
    expect(Object.values(matrix.claude).every(Boolean)).toBe(true);
    // Pi: no subagents / hooks / mcp.
    expect(matrix.pi.subagents).toBe(false);
    expect(matrix.pi.hooks).toBe(false);
    expect(matrix.pi.mcpServers).toBe(false);
    expect(matrix.pi.skills).toBe(true);
    // OpenCode: only hooks are code-only.
    expect(matrix.opencode.hooks).toBe(false);
    expect(matrix.opencode.subagents).toBe(true);
    expect(matrix.opencode.mcpServers).toBe(true);
  });

  it("matches every harness's own supports map", () => {
    for (const id of [
      "claude",
      "codex",
      "pi",
      "opencode",
      "gemini",
      "copilot",
    ] as const) {
      expect(matrix[id]).toEqual(
        Object.fromEntries(
          Object.entries(getHarness(id).supports),
        ),
      );
    }
  });
});

describe("emitFor — the common-vs-bespoke driver", () => {
  const plugin = definePlugin({
    id: "warn-kit",
    description: "Exercises capability gating.",
    subagents: [
      defineSubagent({
        name: "rev",
        description: "Reviews. Use after writing code.",
        prompt: "Review the diff.",
      }),
    ],
  });

  it("strips an unsupported feature AND records a warning (no throw, no file)", () => {
    const { files, warnings } = emitFor(getHarness("pi"), plugin);
    expect(files.some((f) => f.path.startsWith("agents/"))).toBe(false);
    expect(files.some((f) => f.path.endsWith("_NOTE.md"))).toBe(false);
    const w = warnings.find(
      (x) => x.type === "unsupported-feature" && x.feature === "subagents",
    );
    expect(w).toBeTruthy();
    if (w && w.type === "unsupported-feature") {
      expect(w.items).toEqual(["rev"]);
      expect(w.details).toMatch(/Pi has no subagent/);
    }
  });

  it("emits the feature with no warning where the harness supports it", () => {
    const { files, warnings } = emitFor(getHarness("claude"), plugin);
    expect(files.some((f) => f.path === "agents/rev.md")).toBe(true);
    expect(warnings).toEqual([]);
  });
});

describe("option-level warnings (portable field, unsupported on a target)", () => {
  const plugin = definePlugin({
    id: "tools-kit",
    description: "A subagent with a tool allowlist.",
    subagents: [
      defineSubagent({
        name: "rev",
        description: "Reviews. Use after writing code.",
        tools: ["Read", "Grep"],
        prompt: "Review the diff.",
      }),
    ],
  });

  it("Codex & OpenCode warn that the subagent `tools` allowlist is dropped; Claude keeps it", () => {
    const builds = build(plugin);
    for (const id of ["codex", "opencode"] as const) {
      const b = builds.find((x) => x.harness === id)!;
      const w = b.warnings.find(
        (x) => x.type === "unsupported-option" && x.option === "tools",
      );
      expect(w, `${id} should warn`).toBeTruthy();
      expect(w?.type === "unsupported-option" && w.items).toContain("rev");
    }
    // Claude emits per-agent tools, so no option warning.
    const claude = builds.find((x) => x.harness === "claude")!;
    expect(claude.warnings.some((x) => x.type === "unsupported-option")).toBe(false);
    // Pi has no subagents at all → a feature warning, not an option warning.
    const pi = builds.find((x) => x.harness === "pi")!;
    expect(pi.warnings.some((x) => x.type === "unsupported-option")).toBe(false);
    expect(
      pi.warnings.some((x) => x.type === "unsupported-feature" && x.feature === "subagents"),
    ).toBe(true);
  });
});

describe("formatWarning", () => {
  it("renders a one-line message with items", () => {
    expect(
      formatWarning({
        type: "unsupported-feature",
        harness: "pi",
        feature: "hooks",
        items: ["stop"],
        details: "Pi hooks are TypeScript.",
      }),
    ).toBe("hooks (stop): Pi hooks are TypeScript.");
  });
});
