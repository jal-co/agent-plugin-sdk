import { describe, expect, it } from "vitest";
import {
  build,
  defineCommand,
  defineHook,
  definePlugin,
  defineSkill,
  defineSubagent,
} from "../src/index.js";

function copilotFiles(plugin: Parameters<typeof build>[0]) {
  const [out] = build(plugin, { targets: ["copilot"] });
  const map = new Map(out!.files.map((f) => [f.path, f.content]));
  return { out: out!, get: (p: string) => map.get(p), map };
}

describe("GitHub Copilot harness", () => {
  it("writes instructions to .github/copilot-instructions.md", () => {
    const { get } = copilotFiles(
      definePlugin({
        id: "demo",
        description: "d",
        instructions: "Follow the style guide.",
      }),
    );
    expect(get(".github/copilot-instructions.md")).toContain(
      "Follow the style guide.",
    );
  });

  it("emits skills under .github/skills with disable-model-invocation", () => {
    const { get } = copilotFiles(
      definePlugin({
        id: "demo",
        description: "d",
        skills: [
          defineSkill({
            name: "diff-review",
            description: "Review a diff.",
            instructions: "Run git diff.",
            disableModelInvocation: true,
          }),
        ],
      }),
    );
    const skill = get(".github/skills/diff-review/SKILL.md")!;
    expect(skill).toContain('name: "diff-review"');
    expect(skill).toContain("disable-model-invocation: true");
    expect(skill).toContain("Run git diff.");
  });

  it("emits prompt files with .prompt.md and copilot model/agent frontmatter", () => {
    const { get } = copilotFiles(
      definePlugin({
        id: "demo",
        description: "d",
        commands: [
          defineCommand({
            name: "review",
            description: "Review the PR.",
            argumentHint: "[pr-url]",
            body: "Review this PR carefully.",
            harness: { copilot: { model: "Claude Sonnet 4.5", agent: "ask" } },
          }),
        ],
      }),
    );
    const prompt = get(".github/prompts/review.prompt.md")!;
    expect(prompt).toContain('description: "Review the PR."');
    expect(prompt).toContain('argument-hint: "[pr-url]"');
    expect(prompt).toContain('agent: "ask"');
    expect(prompt).toContain('model: "Claude Sonnet 4.5"');
    expect(prompt).toContain("Review this PR carefully.");
  });

  it("emits custom agents at .github/agents/<name>.agent.md", () => {
    const { get } = copilotFiles(
      definePlugin({
        id: "demo",
        description: "d",
        subagents: [
          defineSubagent({
            name: "planner",
            description: "Plans work.",
            prompt: "You generate plans.",
            tools: ["search/codebase", "web/fetch"],
            harness: { copilot: { model: "GPT-5.2" } },
          }),
        ],
      }),
    );
    const agent = get(".github/agents/planner.agent.md")!;
    expect(agent).toContain('name: "planner"');
    expect(agent).toContain('- "search/codebase"');
    expect(agent).toContain('model: "GPT-5.2"');
    expect(agent).toContain("You generate plans.");
  });

  it("emits MCP into .vscode/mcp.json under `servers` with a type discriminator", () => {
    const { get } = copilotFiles(
      definePlugin({
        id: "demo",
        description: "d",
        mcpServers: {
          github: { command: "npx", args: ["-y", "srv"] },
          api: { transport: "http", url: "https://x.test/mcp", headers: { A: "b" } },
        },
      }),
    );
    const mcp = JSON.parse(get(".vscode/mcp.json")!);
    expect(mcp.servers.github).toEqual({
      type: "stdio",
      command: "npx",
      args: ["-y", "srv"],
    });
    expect(mcp.servers.api).toEqual({
      type: "http",
      url: "https://x.test/mcp",
      headers: { A: "b" },
    });
  });

  it("emits PascalCase hooks and warns when a matcher is set", () => {
    const { get, out } = copilotFiles(
      definePlugin({
        id: "demo",
        description: "d",
        hooks: [
          defineHook({
            event: "pre-tool-use",
            matcher: "editFiles",
            command: "scan.sh",
            timeout: 10,
          }),
        ],
      }),
    );
    const hooks = JSON.parse(get(".github/copilot/hooks.json")!);
    expect(hooks.hooks.PreToolUse[0]).toMatchObject({
      type: "command",
      command: "scan.sh",
      timeout: 10, // seconds, no scaling
    });
    expect(
      out.warnings.some(
        (w) => w.type === "unsupported-option" && w.option === "matcher",
      ),
    ).toBe(true);
  });

  it("bundles custom tools as an MCP server using ${workspaceFolder}", () => {
    const { get } = copilotFiles(
      definePlugin({
        id: "demo",
        description: "d",
        tools: { module: "./tools.ts" },
      }),
    );
    const mcp = JSON.parse(get(".vscode/mcp.json")!);
    expect(mcp.servers["demo-tools"].args).toContain(
      "${workspaceFolder}/mcp/server.ts",
    );
    expect(get("mcp/server.ts")).toContain("runMcpStdio");
  });
});
