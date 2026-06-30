/**
 * The shared tool primitive.
 *
 * A custom tool is real code — a handler the agent calls. Every harness can run
 * one, but each exposes a different registration API (Pi `pi.registerTool`,
 * OpenCode plugin `tool: {}`, MCP `tools/call` for Claude/Codex). You write the
 * handler **once** with {@link defineTool}; the SDK's adapters wire it into each
 * runtime. This is the bridge between the declarative layer (skills, commands,
 * hooks) and the harnesses whose tools are code-only.
 */

/** JSON Schema for a tool's input. Kept loose so any schema builder works. */
export interface JsonSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

/** A block of tool output. Mirrors the MCP content shape. */
export type ToolContent =
  | { type: "text"; text: string }
  | { type: "json"; json: unknown };

/** What a tool handler returns. */
export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}

/**
 * Harness-neutral context passed to every tool handler. Adapters fill in what
 * their runtime provides; everything is optional so one handler runs anywhere.
 */
export interface ToolContext {
  /** The harness running the tool, when known. */
  harness?: string;
  /** The working directory, when the runtime exposes one. */
  cwd?: string;
  /** An AbortSignal for cancellation, when the runtime provides one. */
  signal?: AbortSignal;
}

/** A portable custom tool: metadata + a single async handler. */
export interface Tool<Args = Record<string, unknown>> {
  name: string;
  description: string;
  /** JSON Schema describing the tool's arguments. */
  parameters: JsonSchema;
  /** The handler. Receives validated args and a normalized context. */
  execute: (args: Args, ctx: ToolContext) => Promise<ToolResult> | ToolResult;
}

/** Define a portable tool. Identity helper for types + autocomplete. */
export function defineTool<Args = Record<string, unknown>>(
  tool: Tool<Args>,
): Tool<Args> {
  return tool;
}

/** Build a text tool result. */
export function text(value: string): ToolResult {
  return { content: [{ type: "text", text: value }] };
}

/** Build a JSON tool result (serialized to text for runtimes that need it). */
export function json(value: unknown): ToolResult {
  return { content: [{ type: "json", json: value }] };
}

/** Build an error tool result. */
export function error(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Normalize content to a plain string (used by adapters that want text). */
export function contentToText(result: ToolResult): string {
  return result.content
    .map((c) => (c.type === "text" ? c.text : JSON.stringify(c.json, null, 2)))
    .join("\n");
}

/** A tool's public surface, for listing/inspection (no handler). */
export interface ToolInfo {
  name: string;
  description: string;
  parameters: JsonSchema;
}

/** List a tool set's public surface — used by the `ap-sdk tools` runner. */
export function listTools(tools: Tool[]): ToolInfo[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

/**
 * Invoke a tool by name, in-process. The local-test primitive: call a plugin's
 * `defineTool` handlers directly — no harness, no MCP server, no publish — and
 * assert on the {@link ToolResult}. Write vitest tests against it, or drive it
 * from `ap-sdk tools <name>`.
 */
export async function callTool(
  tools: Tool[],
  name: string,
  args: Record<string, unknown> = {},
  ctx: ToolContext = {},
): Promise<ToolResult> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(
      `Unknown tool: ${name}. Available: ${tools.map((t) => t.name).join(", ") || "(none)"}`,
    );
  }
  return tool.execute(args, ctx);
}
