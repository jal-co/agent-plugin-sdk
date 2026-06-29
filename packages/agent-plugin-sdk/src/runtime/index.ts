/**
 * `agent-plugin-sdk/runtime` — the shared primitives for code-based tools.
 *
 * Import these in your tools module to write a handler once, then let the SDK's
 * adapters run it as an MCP server (Claude/Codex) or a native Pi/OpenCode tool.
 */
export {
  defineTool,
  text,
  json,
  error,
  contentToText,
  listTools,
  callTool,
} from "./tool.js";
export type {
  Tool,
  ToolContext,
  ToolResult,
  ToolContent,
  ToolInfo,
  JsonSchema,
} from "./tool.js";
export { runMcpStdio } from "./mcp.js";
export type { McpServerOptions } from "./mcp.js";
export { registerPiTools } from "./pi.js";
export { createOpenCodePlugin } from "./opencode.js";
