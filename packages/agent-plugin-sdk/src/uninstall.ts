import {
  existsSync,
  readFileSync,
  rmSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import type { HarnessId } from "./types.js";
import type { InstallScope } from "./harnesses/types.js";
import {
  contextBlockRegex,
  installManifestPath,
  type InstalledItem,
  type InstallManifest,
} from "./install.js";

export interface UninstallOptions {
  scope?: InstallScope;
  targets?: HarnessId[];
  dryRun?: boolean;
}

export interface RemovedItem {
  harness: HarnessId;
  kind: string;
  name: string;
  files: string[];
  note?: string;
}

type ManifestItem = Omit<InstalledItem, "note">;

/** Reverse a manifest-backed install without touching unrecorded user files. */
export function uninstallPlugin(
  pluginId: string,
  options: UninstallOptions = {},
): RemovedItem[] {
  const scope = options.scope ?? "project";
  const manifestFile = installManifestPath(scope);
  const manifest = readManifest(manifestFile);
  const entry = manifest.plugins[pluginId];
  if (!entry) {
    throw new Error(`No install manifest entry found for plugin "${pluginId}" in ${manifestFile}.`);
  }

  const targetSet = options.targets ? new Set(options.targets) : null;
  const selected = entry.items.filter((item) => !targetSet || targetSet.has(item.harness));
  if (selected.length === 0) {
    throw new Error(`No recorded install items for plugin "${pluginId}" matched the requested target(s).`);
  }

  const removed = selected.map((item) => removeItem(pluginId, item, !!options.dryRun));

  if (!options.dryRun) {
    const remaining = entry.items.filter((item) => targetSet && !targetSet.has(item.harness));
    if (remaining.length > 0) {
      entry.items = remaining;
    } else {
      delete manifest.plugins[pluginId];
    }
    writeOrRemoveManifest(manifestFile, manifest);
  }

  return removed;
}

function removeItem(pluginId: string, item: ManifestItem, dryRun: boolean): RemovedItem {
  switch (item.kind) {
    case "skill":
    case "command":
    case "subagent":
    case "file":
      return removeFiles(item, dryRun);
    case "context":
      return removeContext(pluginId, item, dryRun);
    case "mcp":
      return removeMcp(item, dryRun);
    case "hook":
      return removeHooks(item, dryRun);
    default:
      return { ...item, note: `unknown install item kind "${item.kind}"; skipped` };
  }
}

function removeFiles(item: ManifestItem, dryRun: boolean): RemovedItem {
  const missing: string[] = [];
  for (const file of item.files) {
    if (!existsSync(file)) {
      missing.push(file);
      continue;
    }
    if (!dryRun) unlinkSync(file);
  }
  if (!dryRun && item.kind === "skill") {
    const dir = commonDir(item.files);
    if (dir) {
      try {
        rmdirSync(dir);
      } catch {
        // Non-empty or already removed; leave it alone.
      }
    }
  }
  return {
    harness: item.harness,
    kind: item.kind,
    name: item.name,
    files: item.files,
    note: missing.length ? `skipped ${missing.length} missing recorded file(s)` : undefined,
  };
}

function removeContext(pluginId: string, item: ManifestItem, dryRun: boolean): RemovedItem {
  const file = item.files[0];
  if (!file || !existsSync(file)) return { ...item, note: "recorded context file is missing; skipped" };
  const raw = readFileSync(file, "utf8");
  const next = raw.replace(contextBlockRegex(pluginId), "").replace(/\n{3,}/g, "\n\n");
  if (!dryRun && next !== raw) writeFileSync(file, next);
  return { harness: item.harness, kind: item.kind, name: item.name, files: item.files };
}

function removeMcp(item: ManifestItem, dryRun: boolean): RemovedItem {
  const file = item.files[0];
  const detail = item.detail as { mergeKey?: string; names?: string[] } | undefined;
  if (!file || !existsSync(file)) return { ...item, note: "recorded MCP config is missing; skipped" };
  if (!detail?.mergeKey || !detail.names) return { ...item, note: "manifest lacks MCP merge details; skipped" };
  try {
    const root = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    const bucket = (root[detail.mergeKey] as Record<string, unknown>) ?? {};
    for (const name of detail.names) delete bucket[name];
    root[detail.mergeKey] = bucket;
    if (!dryRun) writeFileSync(file, JSON.stringify(root, null, 2) + "\n");
    return { harness: item.harness, kind: item.kind, name: item.name, files: item.files };
  } catch (err) {
    return { ...item, note: `config is not valid JSON; skipped (${(err as Error).message})` };
  }
}

function removeHooks(item: ManifestItem, dryRun: boolean): RemovedItem {
  const file = item.files[0];
  const detail = item.detail as { hooks?: Record<string, unknown[]> } | undefined;
  if (!file || !existsSync(file)) return { ...item, note: "recorded hook config is missing; skipped" };
  if (!detail?.hooks) return { ...item, note: "manifest lacks hook details; skipped" };
  try {
    const root = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    const hooks = (root.hooks as Record<string, unknown[]>) ?? {};
    for (const [event, groups] of Object.entries(detail.hooks)) {
      const remove = new Set(groups.map((group) => JSON.stringify(group)));
      hooks[event] = (hooks[event] ?? []).filter((group) => !remove.has(JSON.stringify(group)));
    }
    root.hooks = hooks;
    if (!dryRun) writeFileSync(file, JSON.stringify(root, null, 2) + "\n");
    return { harness: item.harness, kind: item.kind, name: item.name, files: item.files };
  } catch (err) {
    return { ...item, note: `config is not valid JSON; skipped (${(err as Error).message})` };
  }
}

function readManifest(file: string): InstallManifest {
  if (!existsSync(file)) throw new Error(`No install manifest found at ${file}.`);
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as InstallManifest;
    if (parsed.version !== 1 || !parsed.plugins) throw new Error("unsupported manifest shape");
    return parsed;
  } catch (err) {
    throw new Error(`Could not read install manifest ${file}: ${(err as Error).message}`);
  }
}

function writeOrRemoveManifest(file: string, manifest: InstallManifest): void {
  if (Object.keys(manifest.plugins).length === 0) {
    rmSync(file, { force: true });
    try {
      rmdirSync(dirname(file));
    } catch {
      // Leave the directory when it has other content.
    }
    return;
  }
  writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
}

function commonDir(files: string[]): string | null {
  if (files.length === 0) return null;
  let parts = dirname(files[0]!).split(/[\\/]+/);
  for (const file of files.slice(1)) {
    const next = dirname(file).split(/[\\/]+/);
    let i = 0;
    while (i < parts.length && parts[i] === next[i]) i++;
    parts = parts.slice(0, i);
  }
  return parts.join("/") || null;
}
