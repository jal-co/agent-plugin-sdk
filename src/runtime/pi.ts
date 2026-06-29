import type { Tool } from "./tool.js";
import { contentToText } from "./tool.js";

/**
 * Register portable tools into a Pi extension. The generated Pi entry file calls
 * this with the Pi `ExtensionAPI`, so your `defineTool` handlers run natively
 * inside Pi via `pi.registerTool`.
 *
 * `pi` is typed loosely to avoid a hard dependency on `@earendil-works/pi-coding-agent`;
 * the generated entry passes the real `ExtensionAPI`.
 */
export function registerPiTools(pi: any, tools: Tool[]): void {
  for (const tool of tools) {
    pi.registerTool({
      name: tool.name,
      label: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      async execute(_toolCallId: string, params: any, signal: AbortSignal) {
        const result = await tool.execute(params ?? {}, {
          harness: "pi",
          cwd: process.cwd(),
          signal,
        });
        return {
          content: [{ type: "text", text: contentToText(result) }],
          details: {},
          isError: result.isError ?? false,
        };
      },
    });
  }
}
