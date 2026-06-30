import { existsSync } from "node:fs";
import { join } from "node:path";

/** File names the CLI treats as a plugin definition when none is given. */
export const DEFAULT_PLUGIN_FILES = [
  "plugin.ts",
  "plugin.js",
  "plugin.mjs",
  "ap-sdk.config.ts",
  "ap-sdk.config.js",
];

/** Find the first default plugin file in `dir`, or `null` if none exists. */
export function locatePlugin(dir: string): string | null {
  for (const name of DEFAULT_PLUGIN_FILES) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return null;
}
