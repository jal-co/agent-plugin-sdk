import type { McpServer } from "../types.js";
import { compact } from "../util/frontmatter.js";

/** Is this a remote (http) server? */
function isHttp(s: McpServer): s is Extract<McpServer, { transport: "http" }> {
  return s.transport === "http";
}

/**
 * Claude Code `.mcp.json` entry.
 * stdio → `{ command, args, env, cwd }` (type optional/omitted).
 * http  → `{ type: "http", url, headers }`.
 */
export function toClaudeEntry(s: McpServer): Record<string, unknown> {
  if (isHttp(s)) {
    return compact({ type: "http", url: s.url, headers: s.headers });
  }
  return compact({
    command: s.command,
    args: s.args,
    env: s.env,
    cwd: s.cwd,
  });
}

/**
 * Codex `.mcp.json` entry. Codex has NO `type` discriminator (inferred from
 * `command` vs `url`) and uses `http_headers` for remote headers.
 */
export function toCodexEntry(s: McpServer): Record<string, unknown> {
  if (isHttp(s)) {
    return compact({ url: s.url, http_headers: s.headers });
  }
  return compact({ command: s.command, args: s.args, env: s.env });
}

/**
 * Gemini CLI entry (lives in `gemini-extension.json` / `settings.json`
 * `mcpServers`). stdio → `{ command, args, env, cwd }`; remote uses `httpUrl`
 * for streamable HTTP (not `url`, which Gemini treats as an SSE endpoint).
 */
export function toGeminiEntry(s: McpServer): Record<string, unknown> {
  if (isHttp(s)) {
    return compact({ httpUrl: s.url, headers: s.headers });
  }
  return compact({
    command: s.command,
    args: s.args,
    env: s.env,
    cwd: s.cwd,
  });
}

/**
 * OpenCode `opencode.json` `mcp` entry. Note the divergences:
 * - `command` is a single ARRAY combining command + args
 * - local env key is `environment` (not `env`)
 * - `type` is `"local"` / `"remote"`
 */
export function toOpenCodeEntry(s: McpServer): Record<string, unknown> {
  if (isHttp(s)) {
    return compact({
      type: "remote",
      url: s.url,
      enabled: true,
      headers: s.headers,
    });
  }
  return compact({
    type: "local",
    command: [s.command, ...(s.args ?? [])],
    enabled: true,
    environment: s.env,
  });
}
