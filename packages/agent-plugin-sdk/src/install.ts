import { join, dirname, basename } from "node:path";
import { homedir } from "node:os";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type {
  HarnessId,
  McpServer,
  OutputFile,
  Plugin,
  PluginFile,
} from "./types.js";
import { allHarnessIds, getHarness } from "./harnesses/index.js";
import type { Harness, InstallScope } from "./harnesses/types.js";
import { emitFor } from "./emit.js";
import { validatePlugin } from "./validate.js";
import { mapValues } from "./util/frontmatter.js";
import { contextBlock } from "./harnesses/shared.js";
import { writeOutputFile } from "./util/fs.js";

export interface InstallOptions {
  targets?: HarnessId[];
  scope?: InstallScope;
  /** When set, plan the install and return it without writing files. */
  dryRun?: boolean;
}

/** One installed feature (skill, command, MCP, context, subagent, hooks, or file). */
export interface InstalledItem {
  harness: HarnessId;
  kind: "skill" | "command" | "mcp" | "context" | "subagent" | "hook" | "file";
  name: string;
  /** Absolute paths written (or that would be written, in dry-run). */
  files: string[];
  /** Extra structured data needed to reverse merged installs. */
  detail?: unknown;
  /** A note about a harness-specific quirk, e.g. Codex commands forced to global. */
  note?: string;
}

export interface InstallManifest {
  version: 1;
  plugins: Record<
    string,
    {
      installedAt: string;
      scope: InstallScope;
      items: Array<Omit<InstalledItem, "note">>;
    }
  >;
}

export function installManifestPath(scope: InstallScope): string {
  return join(scope === "global" ? homedir() : process.cwd(), ".ap-sdk", "install-manifest.json");
}

/**
 * Install a plugin's skills and commands directly into the local harness
 * directories (project-scoped by default, or `~`-global with `scope: "global"`).
 *
 * Reuses each harness's `emit` output so installed files are byte-for-byte
 * identical to what `build` produces — install just relocates each feature's
 * subtree into the harness's real directory.
 */
export function installSkills(
  plugin: Plugin,
  options: InstallOptions = {},
): InstalledItem[] {
  validatePlugin(plugin);
  const targets = options.targets ?? allHarnessIds();
  const scope = options.scope ?? "project";
  const results: InstalledItem[] = [];

  for (const id of targets) {
    const harness = getHarness(id);
    // Route through the same driver as `build` so installed files are byte-for-byte
    // identical and unsupported features are projected out consistently.
    const emitted = emitFor(harness, plugin).files;

    for (const skill of plugin.skills ?? []) {
      results.push(
        installSkill(harness, emitted, skill.name, scope, options.dryRun),
      );
    }

    for (const command of plugin.commands ?? []) {
      const item = installCommand(
        harness,
        emitted,
        command.name,
        scope,
        options.dryRun,
      );
      if (item) results.push(item);
    }

    for (const agent of plugin.subagents ?? []) {
      results.push(
        installSubagent(harness, emitted, agent.name, scope, options.dryRun),
      );
    }

    if (plugin.mcpServers && Object.keys(plugin.mcpServers).length > 0) {
      results.push(
        installMcp(harness, plugin.mcpServers, scope, options.dryRun),
      );
    }

    if ((plugin.hooks ?? []).length > 0) {
      results.push(installHooks(harness, plugin.hooks!, scope, options.dryRun));
    }

    if ((plugin.files ?? []).length > 0) {
      results.push(installFiles(harness, plugin.files!, scope, options.dryRun));
    }

    if (plugin.instructions?.trim()) {
      const target = harness.contextInstallPath(scope);
      if (!options.dryRun) {
        mergeMarkdownBlock(target, plugin.id, plugin.instructions);
      }
      results.push({
        harness: harness.id,
        kind: "context",
        name: harness.contextFileName,
        files: [target],
      });
    }
  }

  if (!options.dryRun) {
    writeInstallManifest(plugin.id, scope, results);
  }

  return results;
}


/** Regex matching the SDK-managed instruction block for a plugin id. */
export function contextBlockRegex(pluginId: string): RegExp {
  const escaped = pluginId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `<!-- agent-plugin-sdk:${escaped} START[\\s\\S]*?<!-- agent-plugin-sdk:${escaped} END -->`,
  );
}

/**
 * Merge the plugin's instruction block into a markdown instruction file,
 * replacing any prior block for the same plugin id (idempotent) and preserving
 * the rest of the file. Appends if no prior block exists.
 */
export function mergeMarkdownBlock(
  file: string,
  pluginId: string,
  instructions: string,
): void {
  const block = contextBlock(pluginId, instructions);
  const escaped = pluginId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<!-- agent-plugin-sdk:${escaped} START[\\s\\S]*?<!-- agent-plugin-sdk:${escaped} END -->`,
  );

  let content = "";
  if (existsSync(file)) content = readFileSync(file, "utf8");

  if (re.test(content)) {
    content = content.replace(re, block);
  } else {
    content = content.trim()
      ? `${content.trimEnd()}\n\n${block}\n`
      : `${block}\n`;
  }

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function installSubagent(
  harness: Harness,
  emitted: OutputFile[],
  name: string,
  scope: InstallScope,
  dryRun: boolean | undefined,
): InstalledItem {
  const target = harness.subagentInstallPath(scope, name);
  if (!target) {
    return {
      harness: harness.id,
      kind: "subagent",
      name,
      files: [],
      note: harness.subagentNote ?? "subagents not supported by this harness",
    };
  }
  // Find the emitted agent file by basename (extension differs: .md vs .toml).
  const file = emitted.find((f) => /(^|\/)agents\/[^/]+$/.test(f.path) && f.path.includes(`/${name}.`));
  if (!file) {
    return { harness: harness.id, kind: "subagent", name, files: [] };
  }
  if (!dryRun) writeOutputFile(target, { ...file, path: target });
  return { harness: harness.id, kind: "subagent", name, files: [target] };
}

function installHooks(
  harness: Harness,
  hooks: Plugin["hooks"] & object,
  scope: InstallScope,
  dryRun: boolean | undefined,
): InstalledItem {
  const config = harness.buildHookConfig(hooks);
  const target = harness.hookInstall(scope);

  if (!config || !target) {
    return {
      harness: harness.id,
      kind: "hook",
      name: `${hooks.length} hook(s)`,
      files: [],
      note: harness.hookInstallNote ?? "hooks not installable for this harness",
    };
  }

  if (!dryRun) mergeHooksInto(target, config.hooks);
  return {
    harness: harness.id,
    kind: "hook",
    name: `${hooks.length} hook(s)`,
    files: [target],
    detail: { hooks: config.hooks },
    note: harness.hookInstallNote,
  };
}

/**
 * Merge hook groups into the `hooks` key of a JSON config, appending groups per
 * event and skipping ones already present (idempotent). Preserves all other keys
 * and refuses to clobber a config that isn't valid JSON.
 */
function mergeHooksInto(
  file: string,
  hooks: Record<string, unknown[]>,
): void {
  let root: Record<string, unknown> = {};
  if (existsSync(file)) {
    const raw = readFileSync(file, "utf8").trim();
    if (raw) {
      try {
        root = JSON.parse(raw);
      } catch (err) {
        throw new Error(
          `Refusing to overwrite ${file}: it is not valid JSON (${(err as Error).message}).`,
        );
      }
    }
  }
  const existing = (root.hooks as Record<string, unknown[]>) ?? {};
  for (const [event, groups] of Object.entries(hooks)) {
    const cur = existing[event] ?? [];
    const seen = new Set(cur.map((g) => JSON.stringify(g)));
    for (const g of groups) {
      if (!seen.has(JSON.stringify(g))) cur.push(g);
    }
    existing[event] = cur;
  }
  root.hooks = existing;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(root, null, 2) + "\n");
}

function installMcp(
  harness: Harness,
  servers: Record<string, McpServer>,
  scope: InstallScope,
  dryRun: boolean | undefined,
): InstalledItem {
  const names = Object.keys(servers).join(", ");
  const target = harness.mcpInstall(scope);

  if (!target) {
    return {
      harness: harness.id,
      kind: "mcp",
      name: names,
      files: [],
      note: harness.mcpInstallNote ?? "MCP not installable standalone for this harness",
    };
  }

  const entries = mapValues(servers, target.convert);
  if (!dryRun) {
    mergeJsonKey(target.path, target.mergeKey, entries, target.defaults);
  }
  return {
    harness: harness.id,
    kind: "mcp",
    name: names,
    files: [target.path],
    detail: { mergeKey: target.mergeKey, names: Object.keys(servers) },
    note: `merged ${Object.keys(servers).length} server(s) under "${target.mergeKey}"`,
  };
}

/**
 * Merge `entries` into `file`'s `key` object, preserving everything else in the
 * file. New servers override existing ones of the same name. Creates the file
 * (with `defaults`) if absent. Throws if the existing file isn't valid JSON, so
 * we never clobber a config we can't safely read.
 */
function mergeJsonKey(
  file: string,
  key: string,
  entries: Record<string, unknown>,
  defaults: Record<string, unknown> | undefined,
): void {
  let root: Record<string, unknown> = { ...(defaults ?? {}) };
  if (existsSync(file)) {
    const raw = readFileSync(file, "utf8").trim();
    if (raw) {
      try {
        root = JSON.parse(raw);
      } catch (err) {
        throw new Error(
          `Refusing to overwrite ${file}: it is not valid JSON (${(err as Error).message}). ` +
            `Fix or remove it, then re-run.`,
        );
      }
    }
  }
  const existing = (root[key] as Record<string, unknown>) ?? {};
  root[key] = { ...existing, ...entries };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(root, null, 2) + "\n");
}

/**
 * Install the plugin's companion files under the harness's `filesInstallDir`
 * (the local analog of the build plugin root), preserving each file's subpath
 * and executable bit. Skips with a note when the harness has no such location.
 */
function installFiles(
  harness: Harness,
  files: PluginFile[],
  scope: InstallScope,
  dryRun: boolean | undefined,
): InstalledItem {
  const base = harness.filesInstallDir?.(scope) ?? null;
  const name = `${files.length} file(s)`;
  if (!base) {
    return {
      harness: harness.id,
      kind: "file",
      name,
      files: [],
      note: `${harness.displayName} has no install location for companion files — they still ship in the build tree.`,
    };
  }
  const written: string[] = [];
  for (const file of files) {
    const abs = join(base, file.path);
    if (!dryRun) {
      writeOutputFile(abs, {
        path: abs,
        content: file.content,
        executable: file.executable,
      });
    }
    written.push(abs);
  }
  return { harness: harness.id, kind: "file", name, files: written };
}

function installSkill(
  harness: Harness,
  emitted: OutputFile[],
  name: string,
  scope: InstallScope,
  dryRun: boolean | undefined,
): InstalledItem {
  // Match the skill subtree by the `skills/<name>/` segment wherever it appears
  // (harnesses emit it under `skills/`, `.github/skills/`, `.windsurf/skills/`, …),
  // then relativize each file to the part after that segment.
  const seg = `skills/${name}/`;
  const dir = harness.skillInstallDir(scope, name);
  const files: string[] = [];

  for (const f of emitted) {
    const idx = f.path.indexOf(seg);
    if (idx === -1) continue;
    const rel = f.path.slice(idx + seg.length);
    const abs = join(dir, rel);
    if (!dryRun) writeOutputFile(abs, { ...f, path: abs });
    files.push(abs);
  }

  return { harness: harness.id, kind: "skill", name, files };
}

function installCommand(
  harness: Harness,
  emitted: OutputFile[],
  name: string,
  scope: InstallScope,
  dryRun: boolean | undefined,
): InstalledItem | null {
  const target = harness.commandInstallPath(scope, name);
  if (!target) return null;

  // Match the emitted command file by the install target's basename, so we stay
  // agnostic to the directory (commands/ vs prompts/ vs workflows/) and the
  // extension (.md vs .toml vs .prompt.md).
  const wanted = basename(target);
  const file = emitted.find((f) => basename(f.path) === wanted);
  if (!file) return null;

  if (!dryRun) writeOutputFile(target, { ...file, path: target });

  let note: string | undefined;
  if (harness.commandsGlobalOnly && scope === "project") {
    note = `${harness.displayName} commands are global-only → installed to ${dirname(target)}`;
  }

  return { harness: harness.id, kind: "command", name, files: [target], note };
}


function writeInstallManifest(
  pluginId: string,
  scope: InstallScope,
  items: InstalledItem[],
): void {
  const file = installManifestPath(scope);
  const manifest = readInstallManifest(file);
  manifest.plugins[pluginId] = {
    installedAt: new Date().toISOString(),
    scope,
    items: items.map(({ note: _note, ...item }) => item),
  };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
}

function readInstallManifest(file: string): InstallManifest {
  if (!existsSync(file)) return { version: 1, plugins: {} };
  const raw = readFileSync(file, "utf8").trim();
  if (!raw) return { version: 1, plugins: {} };
  try {
    const parsed = JSON.parse(raw) as InstallManifest;
    if (parsed.version !== 1 || !parsed.plugins || typeof parsed.plugins !== "object") {
      throw new Error("unsupported manifest shape");
    }
    return parsed;
  } catch (err) {
    throw new Error(
      `Refusing to overwrite ${file}: it is not valid install manifest JSON (${(err as Error).message}).`,
    );
  }
}
