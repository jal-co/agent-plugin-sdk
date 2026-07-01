import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { definePlugin, installSkills } from "../src/index.js";

let cwd: string;
let prev: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "aps-install-files-"));
  prev = process.cwd();
  process.chdir(cwd);
});
afterEach(() => {
  process.chdir(prev);
  rmSync(cwd, { recursive: true, force: true });
});

describe("companion file install", () => {
  const plugin = definePlugin({
    id: "with-files",
    description: "ships companion files",
    files: [
      { path: "hooks/notify.sh", content: "#!/bin/sh\necho hi", executable: true },
      { path: "doctrine/rules.md", content: "# Rules" },
    ],
  });

  it("relocates files under the harness's filesInstallDir (project scope)", () => {
    const installed = installSkills(plugin, { targets: ["claude"] });
    const item = installed.find((i) => i.kind === "file");
    expect(item).toBeDefined();
    expect(item?.files.length).toBe(2);

    expect(existsSync(join(cwd, ".claude", "hooks", "notify.sh"))).toBe(true);
    expect(readFileSync(join(cwd, ".claude", "doctrine", "rules.md"), "utf8")).toBe(
      "# Rules",
    );
  });

  it("dry-run reports the paths without writing", () => {
    const installed = installSkills(plugin, {
      targets: ["claude"],
      dryRun: true,
    });
    const item = installed.find((i) => i.kind === "file");
    expect(item?.files.length).toBe(2);
    expect(existsSync(join(cwd, ".claude", "hooks", "notify.sh"))).toBe(false);
  });
});
