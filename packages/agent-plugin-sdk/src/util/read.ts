import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PluginFile } from "../types.js";

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

/**
 * Recursively read a directory into companion {@link PluginFile}s so a plugin
 * can ship a whole `src/` folder (hook scripts, reference docs, JSON). Paths are
 * relative to `dir`, optionally under `prefix`, and the executable bit is
 * preserved (so hook scripts stay runnable):
 *
 * ```ts
 * files: [
 *   ...readDir("./src/hooks", import.meta.url, "hooks"),
 *   ...readDir("./src/doctrine", import.meta.url, "doctrine"),
 * ],
 * ```
 */
export function readDir(
  dir: string,
  base?: string,
  prefix = "",
): PluginFile[] {
  const root = isAbsolute(dir) ? dir : resolve(baseDir(base), dir);
  const out: PluginFile[] = [];

  const walk = (abs: string, rel: string): void => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const childAbs = join(abs, entry.name);
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(childAbs, childRel);
      } else if (entry.isFile()) {
        const path = prefix ? `${prefix}/${childRel}` : childRel;
        const executable = (statSync(childAbs).mode & 0o111) !== 0;
        out.push({
          path,
          content: readFileSync(childAbs, "utf8"),
          ...(executable ? { executable: true } : {}),
        });
      }
    }
  };

  walk(root, "");
  return out;
}

function baseDir(base?: string): string {
  if (!base) return process.cwd();
  // `import.meta.url` (or any file: URL) points at the plugin file — use its dir.
  if (base.startsWith("file:")) return dirname(fileURLToPath(base));
  // Otherwise `base` is a directory path.
  return isAbsolute(base) ? base : resolve(process.cwd(), base);
}
