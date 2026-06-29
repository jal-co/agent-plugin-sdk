import { describe, expect, it } from "vitest";
import {
  build,
  defineCommand,
  definePlugin,
  defineSkill,
} from "../src/index.js";

function windsurfFiles(plugin: Parameters<typeof build>[0]) {
  const [out] = build(plugin, { targets: ["windsurf"] });
  const map = new Map(out!.files.map((f) => [f.path, f.content]));
  return { out: out!, get: (p: string) => map.get(p), map };
}

describe("Windsurf harness", () => {
  it("emits instructions to AGENTS.md", () => {
    const { get } = windsurfFiles(
      definePlugin({ id: "demo", description: "d", instructions: "Be careful." }),
    );
    expect(get("AGENTS.md")).toContain("Be careful.");
  });

  it("emits skills under .windsurf/skills with resources", () => {
    const { get } = windsurfFiles(
      definePlugin({
        id: "demo",
        description: "d",
        skills: [
          defineSkill({
            name: "deploy",
            description: "Deploy safely.",
            instructions: "Run the checklist.",
            resources: [{ path: "checklist.md", content: "1. tests\n" }],
          }),
        ],
      }),
    );
    expect(get(".windsurf/skills/deploy/SKILL.md")).toContain('name: "deploy"');
    expect(get(".windsurf/skills/deploy/checklist.md")).toBe("1. tests\n");
  });

  it("emits commands as workflows with description frontmatter", () => {
    const { get } = windsurfFiles(
      definePlugin({
        id: "demo",
        description: "d",
        commands: [
          defineCommand({
            name: "ship",
            description: "Ship it.",
            body: "Run the release steps.",
          }),
        ],
      }),
    );
    const wf = get(".windsurf/workflows/ship.md")!;
    expect(wf).toContain('description: "Ship it."');
    expect(wf).toContain("Run the release steps.");
  });

  it("emits MCP to mcp_config.json; remote uses serverUrl", () => {
    const { get } = windsurfFiles(
      definePlugin({
        id: "demo",
        description: "d",
        mcpServers: {
          github: { command: "npx", args: ["srv"] },
          api: { transport: "http", url: "https://x.test/mcp", headers: { A: "b" } },
        },
      }),
    );
    const mcp = JSON.parse(get("mcp_config.json")!);
    expect(mcp.mcpServers.github).toEqual({ command: "npx", args: ["srv"] });
    expect(mcp.mcpServers.api).toEqual({
      serverUrl: "https://x.test/mcp",
      headers: { A: "b" },
    });
  });
});
