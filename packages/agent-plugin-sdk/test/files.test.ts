import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { build, definePlugin, readDir } from "../src/index.js";
import type { HarnessBuild, OutputFile } from "../src/index.js";

function fileMap(files: OutputFile[]): Map<string, OutputFile> {
  return new Map(files.map((f) => [f.path, f]));
}
function harness(builds: HarnessBuild[], id: string): Map<string, OutputFile> {
  return fileMap(builds.find((x) => x.harness === id)!.files);
}

describe("companion files", () => {
  it("emits companion files into every harness build tree", () => {
    const plugin = definePlugin({
      id: "with-files",
      description: "ships companion files",
      files: [
        { path: "hooks/notify.sh", content: "#!/bin/sh\necho hi", executable: true },
        { path: "doctrine/rules.md", content: "# Rules" },
      ],
    });
    const builds = build(plugin);
    for (const id of ["claude", "codex", "cursor", "pi"]) {
      const files = harness(builds, id);
      expect(files.get("hooks/notify.sh")?.content).toContain("echo hi");
      expect(files.get("hooks/notify.sh")?.executable).toBe(true);
      expect(files.get("doctrine/rules.md")?.content).toBe("# Rules");
    }
  });

  it("readDir loads a folder and preserves the executable bit", () => {
    const dir = mkdtempSync(join(tmpdir(), "ap-files-"));
    mkdirSync(join(dir, "hooks"));
    writeFileSync(join(dir, "hooks", "run.sh"), "#!/bin/sh\ntrue");
    chmodSync(join(dir, "hooks", "run.sh"), 0o755);
    writeFileSync(join(dir, "hooks", "notes.md"), "notes");

    const files = readDir(join(dir, "hooks"), undefined, "hooks");
    const byPath = new Map(files.map((f) => [f.path, f]));
    expect(byPath.get("hooks/run.sh")?.executable).toBe(true);
    expect(byPath.get("hooks/notes.md")?.executable).toBeUndefined();
    expect(byPath.get("hooks/notes.md")?.content).toBe("notes");
  });

  it("a generated file wins a path clash and the companion warns", () => {
    const plugin = definePlugin({
      id: "clash",
      description: "collides",
      hooks: [{ event: "stop", command: "echo done" }],
      files: [{ path: "hooks/hooks.json", content: "companion" }],
    });
    const claude = build(plugin).find((b) => b.harness === "claude")!;
    // The generated hooks.json is kept (real config), not the companion string.
    expect(fileMap(claude.files).get("hooks/hooks.json")?.content).not.toBe(
      "companion",
    );
    expect(
      claude.warnings.some(
        (w) => w.type === "other" && w.message.includes("collides"),
      ),
    ).toBe(true);
  });
});
