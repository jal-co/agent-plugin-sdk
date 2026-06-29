import type { Tool, ToolResult } from "./tool.js";
import { contentToText } from "./tool.js";

/**
 * Run a set of portable tools as an MCP server over stdio (newline-delimited
 * JSON-RPC 2.0). This is how a `defineTool` handler reaches the config-based
 * harnesses: Claude Code and Codex launch this server via the generated
 * `.mcp.json` and call the tools over MCP.
 *
 * Implements the minimal MCP surface: `initialize`, `tools/list`, `tools/call`.
 */
export interface McpServerOptions {
  name: string;
  version?: string;
  /** Streams to read/write; defaults to process stdin/stdout. */
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

const PROTOCOL_VERSION = "2024-11-05";

export function runMcpStdio(tools: Tool[], options: McpServerOptions): void {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const byName = new Map(tools.map((t) => [t.name, t]));

  const send = (msg: unknown) => output.write(JSON.stringify(msg) + "\n");
  const reply = (id: unknown, result: unknown) =>
    send({ jsonrpc: "2.0", id, result });
  const fail = (id: unknown, code: number, message: string) =>
    send({ jsonrpc: "2.0", id, error: { code, message } });

  let buffer = "";
  input.on("data", (chunk: Buffer | string) => {
    buffer += chunk.toString();
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) void handle(line);
    }
  });

  async function handle(line: string): Promise<void> {
    let msg: { id?: unknown; method?: string; params?: any };
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    const { id, method, params } = msg;

    if (method === "initialize") {
      reply(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: options.name, version: options.version ?? "0.0.0" },
      });
      return;
    }

    // Notifications (no id) need no response.
    if (id === undefined) return;

    if (method === "tools/list") {
      reply(id, {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.parameters,
        })),
      });
      return;
    }

    if (method === "tools/call") {
      const tool = byName.get(params?.name);
      if (!tool) {
        fail(id, -32602, `Unknown tool: ${params?.name}`);
        return;
      }
      try {
        const result: ToolResult = await tool.execute(params?.arguments ?? {}, {
          harness: "mcp",
          cwd: process.cwd(),
        });
        reply(id, {
          content: [{ type: "text", text: contentToText(result) }],
          isError: result.isError ?? false,
        });
      } catch (err) {
        reply(id, {
          content: [{ type: "text", text: `Tool error: ${(err as Error).message}` }],
          isError: true,
        });
      }
      return;
    }

    fail(id, -32601, `Method not found: ${method}`);
  }
}
