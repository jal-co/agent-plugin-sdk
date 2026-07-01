import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  watch,
  writeFileSync,
  type FSWatcher,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { HarnessId, Plugin } from "./types.js";
import type { InstallScope } from "./harnesses/types.js";
import { build, type HarnessBuild } from "./build.js";
import { installSkills } from "./install.js";
import { writeTree } from "./util/fs.js";
import { formatWarning } from "./warnings.js";

export interface DevOptions {
  pluginPath: string;
  targets?: HarnessId[];
  out?: string;
  install?: boolean;
  scope?: InstallScope;
  onCycle?: (result: { ok: boolean; error?: Error; warnings: number }) => void;
  signal?: AbortSignal;
}

export interface WrittenBuild {
  harness: HarnessId;
  files: number;
  warnings: HarnessBuild["warnings"];
}

/** Build a plugin and write native artifact trees, including shared tools glue. */
export function writeBuildOutputs(
  plugin: Plugin,
  pluginPath: string,
  options: { targets?: HarnessId[]; out?: string } = {},
): WrittenBuild[] {
  const outDir = options.out ?? ".aps-out";
  const builds = build(plugin, { targets: options.targets });
  const toolsContent = readToolsModule(plugin, pluginPath);
  return builds.map((b) => {
    const root = join(process.cwd(), outDir, b.harness);
    const written = writeTree(root, b.files);
    let count = written.length;
    if (toolsContent !== null) {
      writeFileSync(join(root, "tools.ts"), toolsContent);
      count++;
    }
    return { harness: b.harness, files: count, warnings: b.warnings };
  });
}

/** Watch a plugin directory and rebuild, optionally reinstalling, after changes. */
export async function startDev(options: DevOptions): Promise<void> {
  const pluginPath = resolve(options.pluginPath);
  const root = dirname(pluginPath);
  const outDir = options.out ?? ".aps-out";
  let running = false;
  let pending = false;
  let timer: NodeJS.Timeout | undefined;

  const runCycle = async (): Promise<void> => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      const plugin = await freshImport(pluginPath);
      const written = writeBuildOutputs(plugin, pluginPath, {
        targets: options.targets,
        out: outDir,
      });
      const warnings = written.reduce((sum, b) => sum + b.warnings.length, 0);
      if (options.install) {
        installSkills(plugin, {
          targets: options.targets,
          scope: options.scope ?? "project",
        });
      }
      console.log(
        `  ${tick()} rebuilt ${plugin.id} (${written.length} target(s)${options.install ? ", installed" : ""})`,
      );
      for (const b of written) {
        for (const w of b.warnings) console.log(`    ${warn()} ${formatWarning(w)}`);
      }
      options.onCycle?.({ ok: true, warnings });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`  ${cross()} ${error.message}`);
      options.onCycle?.({ ok: false, error, warnings: 0 });
    } finally {
      running = false;
      if (pending && !options.signal?.aborted) {
        pending = false;
        void runCycle();
      }
    }
  };

  await runCycle();
  if (options.signal?.aborted) return;

  await new Promise<void>((resolvePromise) => {
    const watchers = watchTree(root, outDir, (changed) => {
      if (shouldIgnore(root, changed, outDir)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void runCycle(), 150);
    });
    const stop = () => {
      if (timer) clearTimeout(timer);
      for (const watcher of watchers) watcher.close();
      resolvePromise();
    };
    if (options.signal?.aborted) stop();
    else options.signal?.addEventListener("abort", stop, { once: true });
  });
}

let importNonce = 0;

async function freshImport(path: string): Promise<Plugin> {
  const mod = (await import(`${pathToFileURL(path).href}?t=${Date.now()}-${importNonce++}`)) as {
    default?: Plugin;
  };
  const plugin = mod.default;
  if (!plugin || typeof plugin !== "object") {
    throw new Error(`${path} must \`export default\` a plugin (the result of definePlugin(...)).`);
  }
  return plugin;
}

function readToolsModule(plugin: Plugin, pluginPath: string): string | null {
  if (!plugin.tools) return null;
  const spec = plugin.tools.module;
  const src = isAbsolute(spec) ? spec : resolve(dirname(pluginPath), spec);
  if (!existsSync(src)) {
    throw new Error(`tools module not found: ${src} (from \`tools.module\` = "${spec}")`);
  }
  return readFileSync(src, "utf8");
}

function watchTree(root: string, outDir: string, onChange: (path: string) => void): FSWatcher[] {
  try {
    return [
      watch(root, { recursive: true }, (_event, filename) => {
        onChange(filename ? join(root, filename.toString()) : root);
      }),
    ];
  } catch {
    const watchers: FSWatcher[] = [];
    const add = (dir: string) => {
      watchers.push(
        watch(dir, (_event, filename) => {
          const changed = filename ? join(dir, filename.toString()) : dir;
          onChange(changed);
          if (existsSync(changed)) {
            try {
              if (statSync(changed).isDirectory() && !isIgnoredDir(root, changed, outDir)) {
                add(changed);
              }
            } catch {
              // Ignore races while files are being edited.
            }
          }
        }),
      );
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const child = join(dir, entry.name);
        if (!isIgnoredDir(root, child, outDir)) add(child);
      }
    };
    add(root);
    return watchers;
  }
}

function shouldIgnore(root: string, changed: string, outDir: string): boolean {
  return isIgnoredDir(root, changed, outDir);
}

function isIgnoredDir(root: string, path: string, outDir: string): boolean {
  const rel = relative(root, path).split(/[\\/]+/).filter(Boolean);
  const out = outDir.replace(/^\.\//, "");
  return rel.some(
    (part) =>
      part === "node_modules" ||
      part === ".git" ||
      part === out ||
      (part.startsWith(".") && part !== "."),
  );
}

const tick = () => "\x1b[32m✓\x1b[0m";
const warn = () => "\x1b[33m∅\x1b[0m";
const cross = () => "\x1b[31m✖\x1b[0m";
