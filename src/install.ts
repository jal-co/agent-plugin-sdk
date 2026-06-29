import { join, dirname } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { HarnessId, McpServer, OutputFile, Plugin } from "./types.js";
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

/** One installed feature (skill, command, MCP, context, subagent, or hooks). */
export interface InstalledItem {
  harness: HarnessId;
  kind: "skill" | "command" | "mcp" | "context" | "subagent" | "hook";
  name: string;
  /** Absolute paths written (or that would be written, in dry-run). */
  files: string[];
  /** A note about a harness-specific quirk, e.g. Codex commands forced to global. */
  note?: string;
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
  const targets = options.targets ?? allHarnessIds;
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

  return results;
}

/**
 * Merge the plugin's instruction block into a markdown instruction file,
 * replacing any prior block for the same plugin id (idempotent) and preserving
 * the rest of the file. Appends if no prior block exists.
 */
function mergeMarkdownBlock(
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

function installSkill(
  harness: Harness,
  emitted: OutputFile[],
  name: string,
  scope: InstallScope,
  dryRun: boolean | undefined,
): InstalledItem {
  const prefix = `skills/${name}/`;
  const dir = harness.skillInstallDir(scope, name);
  const files: string[] = [];

  for (const f of emitted.filter((f) => f.path.startsWith(prefix))) {
    const abs = join(dir, f.path.slice(prefix.length));
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

  // The emitted command file lives at <prefix>/<name>.md; find it by basename
  // so we stay agnostic to whether the harness used commands/ or prompts/.
  const file = emitted.find((f) => f.path.endsWith(`/${name}.md`));
  if (!file) return null;

  if (!dryRun) writeOutputFile(target, { ...file, path: target });

  let note: string | undefined;
  if (harness.commandsGlobalOnly && scope === "project") {
    note = `${harness.displayName} commands are global-only → installed to ${dirname(target)}`;
  }

  return { harness: harness.id, kind: "command", name, files: [target], note };
}
