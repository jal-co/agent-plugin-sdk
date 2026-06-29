import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, definePlugin, installSkills } from "../src/index.js";
import type { HarnessBuild, OutputFile } from "../src/index.js";

function fileMap(files: OutputFile[]): Map<string, string> {
  return new Map(files.map((f) => [f.path, f.content]));
}
function harness(builds: HarnessBuild[], id: string): Map<string, string> {
  return fileMap(builds.find((x) => x.harness === id)!.files);
}

const plugin = definePlugin({
  id: "house-rules",
  description: "Project conventions.",
  instructions: "# House rules\n\n- Always run the linter before committing.",
});

describe("context/instruction file emission", () => {
  const builds = build(plugin);

  it("Claude emits CLAUDE.md; the other three emit AGENTS.md", () => {
    expect(harness(builds, "claude").has("CLAUDE.md")).toBe(true);
    expect(harness(builds, "claude").has("AGENTS.md")).toBe(false);
    for (const id of ["codex", "pi", "opencode"]) {
      expect(harness(builds, id).has("AGENTS.md")).toBe(true);
      expect(harness(builds, id).has("CLAUDE.md")).toBe(false);
    }
  });

  it("wraps instructions in id-keyed markers", () => {
    const md = harness(builds, "codex").get("AGENTS.md")!;
    expect(md).toContain("<!-- agent-plugin-sdk:house-rules START");
    expect(md).toContain("Always run the linter");
    expect(md).toContain("<!-- agent-plugin-sdk:house-rules END -->");
  });
});

describe("context install (markdown block merge)", () => {
  let cwd: string;
  let prev: string;
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "aps-ctx-"));
    prev = process.cwd();
    process.chdir(cwd);
  });
  afterEach(() => {
    process.chdir(prev);
    rmSync(cwd, { recursive: true, force: true });
  });

  it("appends to an existing AGENTS.md without touching prior content", () => {
    writeFileSync(join(cwd, "AGENTS.md"), "# Existing\n\nKeep me.\n");
    installSkills(plugin, { targets: ["codex"], scope: "project" });
    const md = readFileSync(join(cwd, "AGENTS.md"), "utf8");
    expect(md).toContain("Keep me.");
    expect(md).toContain("Always run the linter");
  });

  it("is idempotent — re-install replaces the block, no duplication", () => {
    installSkills(plugin, { targets: ["codex"], scope: "project" });
    const once = readFileSync(join(cwd, "AGENTS.md"), "utf8");
    installSkills(plugin, { targets: ["codex"], scope: "project" });
    const twice = readFileSync(join(cwd, "AGENTS.md"), "utf8");
    expect(twice).toBe(once);
    expect(twice.match(/house-rules START/g)).toHaveLength(1);
  });

  it("Codex/Pi/OpenCode share one project AGENTS.md (single block)", () => {
    installSkills(plugin, { targets: ["codex", "pi", "opencode"], scope: "project" });
    const md = readFileSync(join(cwd, "AGENTS.md"), "utf8");
    expect(md.match(/house-rules START/g)).toHaveLength(1);
  });
});
