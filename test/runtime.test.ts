import { describe, expect, it } from "vitest";
import { PassThrough } from "node:stream";
import {
  callTool,
  createOpenCodePlugin,
  defineTool,
  listTools,
  registerPiTools,
  runMcpStdio,
  text,
} from "../src/runtime/index.js";

const echo = defineTool({
  name: "echo",
  description: "Echo upper-cased.",
  parameters: { type: "object", properties: { msg: { type: "string" } }, required: ["msg"] },
  execute: ({ msg }: { msg: string }) => text(`ECHO: ${msg.toUpperCase()}`),
});

describe("runtime adapters — one handler, every harness", () => {
  it("MCP: handles initialize, tools/list, tools/call over stdio", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const replies: any[] = [];
    let buf = "";
    output.on("data", (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line) replies.push(JSON.parse(line));
      }
    });

    runMcpStdio([echo as any], { name: "t", input, output });
    input.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }) + "\n");
    input.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n");
    input.write(
      JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "echo", arguments: { msg: "hi" } } }) + "\n",
    );
    await new Promise((r) => setTimeout(r, 20));

    expect(replies.find((r) => r.id === 1).result.capabilities).toEqual({ tools: {} });
    expect(replies.find((r) => r.id === 2).result.tools[0].name).toBe("echo");
    expect(replies.find((r) => r.id === 3).result).toEqual({
      content: [{ type: "text", text: "ECHO: HI" }],
      isError: false,
    });
  });

  it("Pi: registers via pi.registerTool and runs the handler", async () => {
    const registered: any[] = [];
    registerPiTools({ registerTool: (t: any) => registered.push(t) }, [echo as any]);
    expect(registered[0].name).toBe("echo");
    const out = await registered[0].execute("call-1", { msg: "yo" }, new AbortController().signal);
    expect(out.content[0].text).toBe("ECHO: YO");
  });

  it("OpenCode: exposes a tool map whose handler runs", async () => {
    const factory = createOpenCodePlugin([echo as any]);
    const { tool } = await factory({});
    expect(Object.keys(tool)).toEqual(["echo"]);
    const out = await (tool as any).echo.execute({ msg: "hey" });
    expect(out).toBe("ECHO: HEY");
  });

  it("in-process: listTools + callTool run a handler with no transport", async () => {
    expect(listTools([echo as any])).toEqual([
      {
        name: "echo",
        description: "Echo upper-cased.",
        parameters: echo.parameters,
      },
    ]);
    const out = await callTool([echo as any], "echo", { msg: "local" });
    expect(out.content[0]).toEqual({ type: "text", text: "ECHO: LOCAL" });
    await expect(callTool([echo as any], "nope")).rejects.toThrow(/Unknown tool/);
  });

  it("MCP: reports an error result when a tool throws", async () => {
    const boom = defineTool({
      name: "boom",
      description: "throws",
      parameters: { type: "object" },
      execute: () => {
        throw new Error("kaboom");
      },
    });
    const input = new PassThrough();
    const output = new PassThrough();
    const replies: any[] = [];
    let buf = "";
    output.on("data", (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line) replies.push(JSON.parse(line));
      }
    });
    runMcpStdio([boom as any], { name: "t", input, output });
    input.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "boom", arguments: {} } }) + "\n");
    await new Promise((r) => setTimeout(r, 20));
    expect(replies[0].result.isError).toBe(true);
    expect(replies[0].result.content[0].text).toContain("kaboom");
  });
});
