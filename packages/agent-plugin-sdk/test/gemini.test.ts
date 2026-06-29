import { describe, expect, it } from "vitest";
import {
  build,
  defineCommand,
  defineHook,
  definePlugin,
  defineSkill,
  defineSubagent,
} from "../src/index.js";

function geminiFiles(plugin: Parameters<typeof build>[0]) {
  const [out] = build(plugin, { targets: ["gemini"] });
  const map = new Map(out!.files.map((f) => [f.path, f.content]));
  return { out: out!, get: (p: string) => map.get(p), map };
}

describe("Gemini CLI harness", () => {
  it("emits a gemini-extension.json manifest with context + mcp", () => {
    const { get } = geminiFiles(
      definePlugin({
        id: "demo",
        version: "1.2.3",
        description: "A demo plugin.",
        instructions: "Be concise.",
        mcpServers: {
          github: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-github"],
            env: { GITHUB_TOKEN: "${GITHUB_TOKEN}" },
          },
          api: { transport: "http", url: "https://x.test/mcp", headers: { Authorization: "Bearer t" } },
        },
      }),
    );
    const manifest = JSON.parse(get("gemini-extension.json")!);
    expect(manifest).toMatchObject({
      name: "demo",
      version: "1.2.3",
      description: "A demo plugin.",
      contextFileName: "GEMINI.md",
    });
    // stdio uses command/args/env; http uses httpUrl (not url) + headers.
    expect(manifest.mcpServers.github).toEqual({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_TOKEN: "${GITHUB_TOKEN}" },
    });
    expect(manifest.mcpServers.api).toEqual({
      httpUrl: "https://x.test/mcp",
      headers: { Authorization: "Bearer t" },
    });
    expect(get("GEMINI.md")).toContain("Be concise.");
  });

  it("emits TOML commands and translates $ARGUMENTS to {{args}}", () => {
    const { get, out } = geminiFiles(
      definePlugin({
        id: "demo",
        description: "d",
        commands: [
          defineCommand({
            name: "greet",
            description: "Greet someone.",
            body: "Say hello to $ARGUMENTS now.",
          }),
        ],
      }),
    );
    const toml = get("commands/greet.toml")!;
    expect(toml).toContain('description = "Greet someone."');
    expect(toml).toContain("{{args}}");
    expect(toml).not.toContain("$ARGUMENTS");
    expect(toml).toContain('prompt = """');
    expect(out.warnings).toHaveLength(0);
  });

  it("warns (not throws) on positional args it can't represent", () => {
    const { out } = geminiFiles(
      definePlugin({
        id: "demo",
        description: "d",
        commands: [
          defineCommand({ name: "fix", description: "f", body: "Fix issue #$1." }),
        ],
      }),
    );
    expect(
      out.warnings.some(
        (w) => w.type === "unsupported-option" && w.feature === "commands",
      ),
    ).toBe(true);
  });

  it("emits sub-agents as markdown with YAML frontmatter (tools as a list)", () => {
    const { get } = geminiFiles(
      definePlugin({
        id: "demo",
        description: "d",
        subagents: [
          defineSubagent({
            name: "reviewer",
            description: "Reviews diffs.",
            prompt: "You are a reviewer.",
            tools: ["read_file", "grep_search"],
            harness: { gemini: { model: "gemini-3-flash-preview", temperature: 0.2 } },
          }),
        ],
      }),
    );
    const md = get("agents/reviewer.md")!;
    expect(md).toContain('name: "reviewer"');
    expect(md).toContain('model: "gemini-3-flash-preview"');
    expect(md).toContain('- "read_file"');
    expect(md).toContain("You are a reviewer.");
  });

  it("emits hooks with millisecond timeouts under the BeforeTool event", () => {
    const { get } = geminiFiles(
      definePlugin({
        id: "demo",
        description: "d",
        hooks: [
          defineHook({
            event: "pre-tool-use",
            matcher: "write_file",
            command: "scan.sh",
            timeout: 5,
          }),
        ],
      }),
    );
    const hooks = JSON.parse(get("hooks/hooks.json")!);
    expect(hooks.hooks.BeforeTool[0].matcher).toBe("write_file");
    expect(hooks.hooks.BeforeTool[0].hooks[0]).toMatchObject({
      type: "command",
      command: "scan.sh",
      timeout: 5000, // seconds → ms
    });
  });

  it("bundles custom tools as an MCP server using ${extensionPath}", () => {
    const { get } = geminiFiles(
      definePlugin({
        id: "demo",
        description: "d",
        tools: { module: "./tools.ts" },
      }),
    );
    const manifest = JSON.parse(get("gemini-extension.json")!);
    expect(manifest.mcpServers["demo-tools"].args).toContain(
      "${extensionPath}/mcp/server.ts",
    );
    expect(get("mcp/server.ts")).toContain("runMcpStdio");
  });

  it("emits a skill the harness can read", () => {
    const { get } = geminiFiles(
      definePlugin({
        id: "demo",
        description: "d",
        skills: [
          defineSkill({
            name: "diff-review",
            description: "Review a diff.",
            instructions: "Run git diff and summarize.",
          }),
        ],
      }),
    );
    const skill = get("skills/diff-review/SKILL.md")!;
    expect(skill).toContain('name: "diff-review"');
    expect(skill).toContain("Run git diff and summarize.");
  });
});
