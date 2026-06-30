import { existsSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Plugin } from "./types.js";
import type { Tool } from "./runtime/tool.js";

/**
 * Load a plugin's tools module (the file `plugin.tools.module` points at) and
 * return its default-exported `Tool[]`. Resolves the path relative to the plugin
 * definition file, then dynamic-imports it.
 *
 * This is the loader behind `ap-sdk tools`; pair it with `callTool` /
 * `listTools` from `agent-plugin-sdk/runtime` to test handlers in-process. Run it
 * under a TypeScript loader (e.g. `tsx`) so a `.ts` tools module imports cleanly.
 */
export async function loadPluginTools(
  plugin: Plugin,
  pluginPath: string,
): Promise<Tool[]> {
  if (!plugin.tools) return [];
  const spec = plugin.tools.module;
  const abs = isAbsolute(spec) ? spec : resolve(dirname(pluginPath), spec);
  if (!existsSync(abs)) {
    throw new Error(`tools module not found: ${abs} (from \`tools.module\` = "${spec}")`);
  }
  const mod: { default?: unknown } = await import(pathToFileURL(abs).href);
  const tools = mod.default;
  if (!Array.isArray(tools)) {
    throw new Error(
      `${spec} must \`export default\` an array of defineTool(...) results.`,
    );
  }
  return tools as Tool[];
}
