import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve(process.cwd(), "content/docs/api");
mkdirSync(outDir, { recursive: true });

const groups = [
  {
    slug: "main",
    title: "Main entrypoint",
    description: "Public helpers and types exported by @jalco/ap-sdk.",
    symbols: [
      [
        "definePlugin",
        "Identity helper for a portable plugin definition. Author once, then build or install native artifacts for each harness.",
        "export function definePlugin(plugin: Plugin): Plugin;",
      ],
      [
        "defineSkill",
        "Defines a portable agent skill with a trigger description, instructions, optional resources, and harness metadata.",
        "export function defineSkill(skill: Skill): Skill;",
      ],
      [
        "defineCommand",
        "Defines a portable slash command or prompt command with argument templating and per-harness overrides.",
        "export function defineCommand(command: Command): Command;",
      ],
      [
        "defineSubagent",
        "Defines a specialist agent prompt with optional tools and target-specific model settings.",
        "export function defineSubagent(subagent: Subagent): Subagent;",
      ],
      [
        "defineHook",
        "Defines a lifecycle hook using ap-sdk's portable event names and optional native overrides.",
        "export function defineHook(hook: Hook): Hook;",
      ],
      [
        "Plugin",
        "The root declaration: id, description, instructions, skills, commands, MCP servers, subagents, hooks, files, tools, and marketplace metadata.",
        "export interface Plugin { id: string; description: string; ... }",
      ],
      [
        "Skill",
        "Reusable instructions plus metadata. Descriptions are capped to the tightest harness limit and drive skill routing.",
        "export interface Skill { name: string; description: string; instructions: string; ... }",
      ],
      [
        "Hook",
        "Portable hook event, matcher, command, timeout, async flag, and per-harness event or matcher overrides.",
        "export interface Hook { event: HookEvent; command: string | HookCommand; ... }",
      ],
      [
        "build",
        "Validates a plugin and returns in-memory output files and warnings for each requested harness.",
        "export function build(plugin: Plugin, options?: BuildOptions): HarnessBuild[];",
      ],
      [
        "installSkills",
        "Installs emitted skills, commands, MCP config, hooks, instructions, subagents, and files into live harness directories.",
        "export function installSkills(plugin: Plugin, options?: InstallOptions): InstalledItem[];",
      ],
    ],
  },
  {
    slug: "runtime",
    title: "Runtime entrypoint",
    description: "Runtime helpers for portable tools.",
    symbols: [
      [
        "defineTool",
        "Defines one executable tool with metadata, JSON schema parameters, and a single handler shared across harness adapters.",
        "export function defineTool<Args>(tool: Tool<Args>): Tool<Args>;",
      ],
      [
        "listTools",
        "Loads a tools module and returns the declared tool metadata for local inspection or generated adapters.",
        "export async function listTools(modulePath: string): Promise<Tool[]>;",
      ],
      [
        "callTool",
        "Invokes a named tool locally with JSON arguments, matching the CLI's `ap-sdk tools --call` loop.",
        "export async function callTool(modulePath: string, name: string, args: unknown): Promise<ToolResult>;",
      ],
      [
        "contentToText",
        "Converts structured tool content blocks into plain text for terminal output.",
        "export function contentToText(content: ToolContent[]): string;",
      ],
    ],
  },
  {
    slug: "harness",
    title: "Harness entrypoint",
    description: "Harness authoring toolkit for custom targets.",
    symbols: [
      [
        "defineHarness",
        "Identity helper for a custom target harness: support map, emit translator, install paths, and native config behavior.",
        "export function defineHarness(harness: Harness): Harness;",
      ],
      [
        "registerHarness",
        "Registers a custom harness id so build, install, and CLI target validation can use it.",
        "export function registerHarness(harness: Harness): void;",
      ],
      [
        "Harness",
        "The contract every built-in and custom harness implements: id, display name, support map, emit function, and install path helpers.",
        "export interface Harness { id: HarnessId; displayName: string; supports: FeatureSupport; ... }",
      ],
      [
        "EmitContext",
        "Context passed to emitters, including helper methods and target metadata.",
        "export interface EmitContext { harness: Harness; ... }",
      ],
      [
        "InstallScope",
        "Where install writes artifacts: project directories or home-directory global config.",
        "export type InstallScope = 'project' | 'global';",
      ],
    ],
  },
];

for (const group of groups) {
  const body = group.symbols
    .map(
      ([name, description, signature]) =>
        `## ${name}\n\n${description}\n\n\`\`\`ts\n${signature}\n\`\`\``,
    )
    .join("\n\n");
  writeFileSync(
    resolve(outDir, `${group.slug}.mdx`),
    `---\ntitle: ${group.title}\ndescription: ${group.description}\n---\n\n${body}\n`,
  );
}

writeFileSync(
  resolve(outDir, "index.mdx"),
  `---\ntitle: API reference\ndescription: Generated reference for the public ap-sdk entrypoints.\n---\n\nThis section is generated from source-aligned API metadata. Regenerate it with \`pnpm --filter @jal-co/docs generate:api\`.\n\n<Cards>\n  <Card title="@jalco/ap-sdk" href="/docs/api/main" />\n  <Card title="@jalco/ap-sdk/runtime" href="/docs/api/runtime" />\n  <Card title="@jalco/ap-sdk/harness" href="/docs/api/harness" />\n  <Card title="Feature guides" href="/docs/skills" />\n</Cards>\n`,
);
