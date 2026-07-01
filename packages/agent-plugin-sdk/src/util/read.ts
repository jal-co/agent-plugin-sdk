import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Read a UTF-8 text file so a plugin can keep its prose in a `src/` folder
 * instead of inlining big strings. Resolve `path` relative to `base`:
 *
 * - pass `import.meta.url` (the plugin file) to resolve relative to the plugin's
 *   own directory — the common case;
 * - pass a directory path to resolve against that directory;
 * - omit `base` to resolve against the current working directory.
 *
 * ```ts
 * import { definePlugin, defineSkill, readText } from "@jalco/ap-sdk";
 *
 * export default definePlugin({
 *   id: "my-plugin",
 *   description: "…",
 *   instructions: readText("./src/CLAUDE.md", import.meta.url),
 *   skills: [
 *     defineSkill({
 *       name: "review",
 *       description: "…",
 *       instructions: readText("./src/skills/review.md", import.meta.url),
 *     }),
 *   ],
 * });
 * ```
 */
export function readText(path: string, base?: string): string {
  const abs = isAbsolute(path) ? path : resolve(baseDir(base), path);
  return readFileSync(abs, "utf8");
}

/**
 * Bind a base once and get a reader — ergonomic when a plugin loads many files:
 *
 * ```ts
 * const read = readTextFrom(import.meta.url);
 * instructions: read("./src/CLAUDE.md"),
 * ```
 */
export function readTextFrom(base: string): (path: string) => string {
  return (path: string) => readText(path, base);
}

function baseDir(base?: string): string {
  if (!base) return process.cwd();
  // `import.meta.url` (or any file: URL) points at the plugin file — use its dir.
  if (base.startsWith("file:")) return dirname(fileURLToPath(base));
  // Otherwise `base` is a directory path.
  return isAbsolute(base) ? base : resolve(process.cwd(), base);
}
