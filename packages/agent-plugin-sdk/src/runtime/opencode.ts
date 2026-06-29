import type { Tool } from "./tool.js";
import { contentToText } from "./tool.js";

/**
 * Build an OpenCode plugin object that exposes portable tools. The generated
 * OpenCode entry exports the result of this as its plugin, so your `defineTool`
 * handlers run natively inside OpenCode.
 *
 * Returns an async plugin factory matching OpenCode's `@opencode-ai/plugin`
 * shape. Typed loosely to avoid a hard dependency on the OpenCode SDK.
 */
export function createOpenCodePlugin(tools: Tool[]) {
  return async function plugin(_ctx: any) {
    const toolMap: Record<string, unknown> = {};
    for (const tool of tools) {
      toolMap[tool.name] = {
        description: tool.description,
        args: tool.parameters,
        async execute(args: any) {
          const result = await tool.execute(args ?? {}, {
            harness: "opencode",
            cwd: process.cwd(),
          });
          return contentToText(result);
        },
      };
    }
    return { tool: toolMap };
  };
}
