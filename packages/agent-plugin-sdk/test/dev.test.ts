import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDev } from "../src/dev.js";

let cwd: string;
let prev: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "aps-dev-"));
  prev = process.cwd();
  process.chdir(cwd);
});

afterEach(() => {
  process.chdir(prev);
  rmSync(cwd, { recursive: true, force: true });
});

function pluginSource(description: string, valid = true): string {
  if (!valid) return "export default { id: '', description: '' };\n";
  return `export default {
  id: "dev-plugin",
  description: "d",
  skills: [{ name: "diff-review", description: "${description}", instructions: "do it" }]
};
`;
}

function waitForCycle(cycles: Array<{ ok: boolean }>, index: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (cycles.length > index) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > 5000) {
        clearInterval(timer);
        reject(new Error(`timed out waiting for cycle ${index}`));
      }
    }, 50);
  });
}

describe("startDev", () => {
  it("runs an initial build and resolves on abort", async () => {
    const pluginPath = join(cwd, "plugin.mjs");
    writeFileSync(pluginPath, pluginSource("first"));
    const controller = new AbortController();
    const cycles: Array<{ ok: boolean }> = [];
    const done = startDev({
      pluginPath,
      targets: ["claude"],
      signal: controller.signal,
      onCycle(result) {
        cycles.push(result);
        controller.abort();
      },
    });

    await done;

    expect(cycles[0]?.ok).toBe(true);
    expect(existsSync(join(cwd, ".aps-out", "claude", "skills", "diff-review", "SKILL.md"))).toBe(true);
  });

  it("rebuilds when the plugin changes", async () => {
    const pluginPath = join(cwd, "plugin.mjs");
    writeFileSync(pluginPath, pluginSource("first"));
    const controller = new AbortController();
    const cycles: Array<{ ok: boolean }> = [];
    const done = startDev({
      pluginPath,
      targets: ["claude"],
      signal: controller.signal,
      onCycle(result) {
        cycles.push(result);
      },
    });
    await waitForCycle(cycles, 0);
    writeFileSync(pluginPath, pluginSource("second"));
    await waitForCycle(cycles, 1);
    controller.abort();
    await done;

    const skill = readFileSync(join(cwd, ".aps-out", "claude", "skills", "diff-review", "SKILL.md"), "utf8");
    expect(skill).toContain("second");
  });

  it("survives a validation error and recovers", async () => {
    const pluginPath = join(cwd, "plugin.mjs");
    writeFileSync(pluginPath, pluginSource("first", false));
    const controller = new AbortController();
    const cycles: Array<{ ok: boolean }> = [];
    const done = startDev({
      pluginPath,
      targets: ["claude"],
      signal: controller.signal,
      onCycle(result) {
        cycles.push(result);
      },
    });
    await waitForCycle(cycles, 0);
    writeFileSync(pluginPath, pluginSource("fixed"));
    await waitForCycle(cycles, 1);
    controller.abort();
    await done;

    expect(cycles[0]?.ok).toBe(false);
    expect(cycles[1]?.ok).toBe(true);
  });
});
