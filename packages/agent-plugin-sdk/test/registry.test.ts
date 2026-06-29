import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  allHarnessIds,
  build,
  builtinHarnessIds,
  definePlugin,
  defineHarness,
  getHarness,
  hasHarness,
  registerHarness,
  supportMatrix,
} from "../src/index.js";
import type { Harness } from "../src/index.js";
import {
  deriveDisplayName,
  harnessTemplate,
  validateHarnessId,
} from "../src/scaffold.js";

/** A minimal but valid harness for registry tests. */
function fakeHarness(id: string): Harness {
  return defineHarness({
    specificationVersion: "v1",
    id,
    displayName: `Fake ${id}`,
    supports: {
      instructions: true,
      skills: true,
      commands: false,
      subagents: false,
      hooks: false,
      mcpServers: false,
      tools: false,
    },
    contextFileName: "AGENTS.md",
    emit(plugin) {
      return (plugin.skills ?? []).map((s) => ({
        path: `skills/${s.name}/SKILL.md`,
        content: `# ${s.name}\n`,
      }));
    },
    skillInstallDir: (_scope, name) => join(`.${id}`, "skills", name),
    commandInstallPath: () => null,
    contextInstallPath: () => "AGENTS.md",
    mcpInstall: () => null,
    subagentInstallPath: () => null,
    buildHookConfig: () => null,
    hookInstall: () => null,
  });
}

describe("harness registry", () => {
  it("seeds the four built-ins", () => {
    expect(builtinHarnessIds).toEqual([
      "claude",
      "codex",
      "pi",
      "opencode",
      "gemini",
      "copilot",
      "cursor",
      "windsurf",
    ]);
    for (const id of builtinHarnessIds) expect(hasHarness(id)).toBe(true);
  });

  it("registers a custom harness so it flows through the SDK", () => {
    expect(hasHarness("acme")).toBe(false);
    registerHarness(fakeHarness("acme"));

    expect(hasHarness("acme")).toBe(true);
    expect(allHarnessIds()).toContain("acme");
    expect(getHarness("acme").displayName).toBe("Fake acme");
    expect(supportMatrix().acme!.skills).toBe(true);
    expect(supportMatrix().acme!.commands).toBe(false);
  });

  it("builds for a registered custom harness", () => {
    registerHarness(fakeHarness("widget"));
    const plugin = definePlugin({
      id: "demo",
      description: "demo",
      skills: [
        { name: "hello", description: "hi", instructions: "do the thing" },
      ],
    });
    const [out] = build(plugin, { targets: ["widget"] });
    expect(out!.harness).toBe("widget");
    expect(out!.files.some((f) => f.path === "skills/hello/SKILL.md")).toBe(
      true,
    );
  });

  it("rejects an unknown specification version", () => {
    expect(() =>
      registerHarness({
        ...fakeHarness("bad"),
        // @ts-expect-error — intentionally invalid for the guard test
        specificationVersion: "v2",
      }),
    ).toThrow(/specificationVersion/);
  });

  it("getHarness throws a helpful error for an unknown id", () => {
    expect(() => getHarness("nope")).toThrow(/Unknown harness "nope"/);
  });
});

describe("add-harness scaffold", () => {
  it("derives a display name from a kebab id", () => {
    expect(deriveDisplayName("gemini")).toBe("Gemini");
    expect(deriveDisplayName("gemini-cli")).toBe("Gemini Cli");
  });

  it("validates harness ids", () => {
    expect(validateHarnessId("gemini")).toBeNull();
    expect(validateHarnessId("")).toMatch(/required/);
    expect(validateHarnessId("Gemini")).toMatch(/kebab-case/);
    expect(validateHarnessId("a--b")).toMatch(/kebab-case/);
  });

  it("generates a harness module that compiles, self-registers, and emits", async () => {
    // Point the generated import at this package's local /harness entrypoint so
    // the file resolves without the package being installed.
    const srcDir = resolve(__dirname, "..", "src");
    const source = harnessTemplate("cursor", "Cursor", srcDir);
    expect(source).toContain('id: "cursor"');
    expect(source).toContain("registerHarness(cursor)");

    const dir = mkdtempSync(join(tmpdir(), "aps-harness-"));
    const file = join(dir, "cursor.ts");
    writeFileSync(file, source);

    // Importing the module runs `registerHarness(cursor)` at top level.
    await import(pathToFileURL(file).href);

    expect(hasHarness("cursor")).toBe(true);
    const plugin = definePlugin({
      id: "demo2",
      description: "demo",
      instructions: "Always be kind.",
      skills: [{ name: "greet", description: "g", instructions: "say hi" }],
    });
    const [out] = build(plugin, { targets: ["cursor"] });
    expect(out!.files.some((f) => f.path === "skills/greet/SKILL.md")).toBe(
      true,
    );
    expect(out!.files.some((f) => f.path === "AGENTS.md")).toBe(true);
  });
});
