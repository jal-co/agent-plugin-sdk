import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { portPlugin } from "../src/port.js";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "aps-port-"));
  const w = (p: string, c: string) => {
    mkdirSync(join(dir, p, ".."), { recursive: true });
    writeFileSync(join(dir, p), c);
  };
  mkdirSync(join(dir, ".claude-plugin"), { recursive: true });
  writeFileSync(
    join(dir, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name: "demo-plugin",
      description: "A demo plugin.",
      version: "2.1.0",
      author: { name: "Jane" },
    }),
  );
  w("CLAUDE.md", "# Rules\nBe careful.");
  w(
    "skills/review/SKILL.md",
    "---\nname: review\ndescription: Review code. Use on request.\nallowed-tools: Read, Grep\ncustom-field: yes\n---\n\nDo the review.",
  );
  w(
    "agents/triage.md",
    "---\nname: triage\ndescription: Classify the task.\nmodel: sonnet\ntools: Read, Bash\neffort: high\nstage:\n  routes: [code]\n---\n\nTriage it.",
  );
  w(
    "commands/run.md",
    "---\ndescription: Run the pipeline.\nargument-hint: '[target]'\n---\n\nRun $ARGUMENTS.",
  );
  w(
    "hooks/hooks.json",
    JSON.stringify({
      hooks: {
        Notification: [
          { hooks: [{ command: "hooks/notify.sh", timeout: 5 }] },
        ],
        PermissionRequest: [
          {
            matcher: "ExitPlanMode",
            hooks: [{ command: "hooks/review.sh" }],
          },
        ],
      },
    }),
  );
  w("hooks/notify.sh", "#!/bin/sh\necho hi");
  w("doctrine/rules.md", "# Doctrine");
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("portPlugin", () => {
  it("detects a Claude Code plugin and counts every piece", () => {
    const r = portPlugin(dir);
    expect(r.detected).toBe("Claude Code plugin");
    expect(r.counts).toMatchObject({
      skills: 1,
      subagents: 1,
      commands: 1,
      hooks: 2,
      instructions: true,
    });
  });

  it("generates a plugin.ts that loads files and maps each piece", () => {
    const { code } = portPlugin(dir);
    // manifest
    expect(code).toContain('id: "demo-plugin"');
    expect(code).toContain('version: "2.1.0"');
    // instructions + bodies loaded from files (never inlined)
    expect(code).toContain('instructions: read("./CLAUDE.md")');
    expect(code).toContain('instructions: readBody("./skills/review/SKILL.md")');
    expect(code).toContain('prompt: readBody("./agents/triage.md")');
    expect(code).toContain('body: readBody("./commands/run.md")');
    // skill: known fields + frontmatter passthrough of the unknown one
    expect(code).toContain('allowedTools: ["Read","Grep"]');
    expect(code).toContain('"custom-field":"yes"');
    // subagent: model -> harness override + effort/stage passthrough
    expect(code).toContain('harness: { claude: { model: "sonnet" } }');
    expect(code).toContain('"effort":"high"');
    // hooks: native events reverse-mapped to portable ones
    expect(code).toContain('event: "notification"');
    expect(code).toContain('event: "permission-request"');
    expect(code).toContain('matcher: "ExitPlanMode"');
    // companion dirs shipped
    expect(code).toContain('...readDir("./hooks", import.meta.url, "hooks")');
    expect(code).toContain(
      '...readDir("./doctrine", import.meta.url, "doctrine")',
    );
  });
});
