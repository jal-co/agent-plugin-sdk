#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { HarnessId, Plugin } from "./types.js";
import { allHarnessIds } from "./harnesses/index.js";
import { build } from "./build.js";
import { installSkills } from "./install.js";
import { loadPluginTools } from "./load-tools.js";
import { listTools, callTool, contentToText } from "./runtime/tool.js";
import { formatWarning } from "./warnings.js";
import { writeTree } from "./util/fs.js";
import { PluginValidationError } from "./validate.js";
import {
  harnessTemplate,
  deriveDisplayName,
  validateHarnessId,
} from "./scaffold.js";

const HELP = `agent-plugin — write a plugin once, ship it to every agent harness

Usage:
  agent-plugin build   [plugin] [options]   Compile to native artifacts under an output dir
  agent-plugin install [plugin] [options]   Install skills into local harness dirs
  agent-plugin check   [plugin]             Validate a plugin definition
  agent-plugin tools   [plugin] [options]   List the plugin's tools, or invoke one locally
  agent-plugin add-harness <id> [options]   Scaffold a new target harness module

Arguments:
  plugin   Path to a plugin definition module (default: ./plugin.ts, ./plugin.js,
           ./agent-plugin.config.ts). Must default-export a definePlugin(...) result.
  id       (add-harness) kebab-case id for the new harness, e.g. gemini, cursor.

Options:
  --target, -t <ids>   Comma-separated harnesses: ${allHarnessIds().join(", ")} (default: all)
  --out, -o <dir>      build: output dir (default: ./.aps-out)
                       add-harness: dir to write the harness file (default: .)
  --name <label>       add-harness: human-readable display name (default: derived from id)
  --global, -g         install: write to ~ global harness dirs instead of project
  --dry-run            install/add-harness: print what would be written without writing
  --call <name>        tools: invoke this tool instead of listing
  --args <json>        tools: JSON arguments for --call (default: {})
  --help, -h           Show this help

Examples:
  agent-plugin build
  agent-plugin build ./my-plugin.ts -t claude,codex -o dist
  agent-plugin install -t opencode
  agent-plugin tools
  agent-plugin tools --call run_tests --args '{"pattern":"sum"}'
  agent-plugin add-harness gemini --name "Gemini CLI"
`;

interface Args {
  command?: string;
  plugin?: string;
  targets?: HarnessId[];
  out?: string;
  name?: string;
  global?: boolean;
  dryRun?: boolean;
  call?: string;
  toolArgs?: string;
  help?: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    switch (a) {
      case "--help":
      case "-h":
        args.help = true;
        break;
      case "--global":
      case "-g":
        args.global = true;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--target":
      case "-t":
        args.targets = parseTargets(argv[++i]);
        break;
      case "--out":
      case "-o":
        args.out = argv[++i];
        break;
      case "--name":
        args.name = argv[++i];
        break;
      case "--call":
        args.call = argv[++i];
        break;
      case "--args":
        args.toolArgs = argv[++i];
        break;
      default:
        if (a.startsWith("--target=")) args.targets = parseTargets(a.slice(9));
        else if (a.startsWith("-o=") || a.startsWith("--out="))
          args.out = a.split("=")[1];
        else if (a.startsWith("--call=")) args.call = a.slice(7);
        else if (a.startsWith("--args=")) args.toolArgs = a.slice(7);
        else if (a.startsWith("--name=")) args.name = a.slice(7);
        else positionals.push(a);
    }
  }
  args.command = positionals[0];
  args.plugin = positionals[1];
  return args;
}

function parseTargets(value: string | undefined): HarnessId[] {
  if (!value) fail("--target requires a value");
  // Split only — validate later (in `main`, after the plugin module has loaded),
  // so a harness the plugin registers via `registerHarness` is recognized too.
  return value!.split(",").map((s) => s.trim()) as HarnessId[];
}

/** Validate requested targets against the registry once it's fully populated. */
function validateTargets(targets: HarnessId[] | undefined): void {
  if (!targets) return;
  const known = allHarnessIds();
  for (const id of targets) {
    if (!known.includes(id)) {
      fail(`Unknown harness "${id}". Registered: ${known.join(", ")}`);
    }
  }
}

const DEFAULT_PLUGIN_FILES = [
  "plugin.ts",
  "plugin.js",
  "plugin.mjs",
  "agent-plugin.config.ts",
  "agent-plugin.config.js",
];

function resolvePluginPath(explicit?: string): string {
  if (explicit) {
    const p = isAbsolute(explicit) ? explicit : resolve(process.cwd(), explicit);
    if (!existsSync(p)) fail(`Plugin file not found: ${p}`);
    return p;
  }
  for (const name of DEFAULT_PLUGIN_FILES) {
    const p = join(process.cwd(), name);
    if (existsSync(p)) return p;
  }
  fail(
    `No plugin file given and none of ${DEFAULT_PLUGIN_FILES.join(", ")} found in ${process.cwd()}.\n` +
      `Pass a path: agent-plugin build ./my-plugin.ts`,
  );
}

/**
 * Enable importing TypeScript (`.ts`) plugin/tools modules directly by
 * registering the bundled `tsx` ESM loader. This lets `agent-plugin <cmd> foo.ts`
 * work as-is — no `tsx` wrapper around the CLI needed.
 */
async function enableTypeScript(): Promise<void> {
  try {
    const tsx: { register?: () => void } = await import("tsx/esm/api");
    tsx.register?.();
  } catch {
    // tsx unavailable — .ts imports will fail below with a clear hint.
  }
}

async function loadPlugin(path: string): Promise<Plugin> {
  let mod: { default?: Plugin };
  try {
    mod = await import(pathToFileURL(path).href);
  } catch (err) {
    if (path.endsWith(".ts")) {
      fail(
        `Failed to import ${path}.\n` +
          `Could not load the TypeScript loader (tsx). Reinstall dependencies, or run with:\n` +
          `  npx tsx node_modules/.bin/agent-plugin ...\n` +
          `Original error: ${(err as Error).message}`,
      );
    }
    throw err;
  }
  const plugin = mod.default;
  if (!plugin || typeof plugin !== "object") {
    fail(
      `${path} must \`export default\` a plugin (the result of definePlugin(...)).`,
    );
  }
  return plugin!;
}

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.command) {
    console.log(HELP);
    process.exit(args.command ? 0 : args.help ? 0 : 1);
  }

  // `add-harness` scaffolds a new harness file and needs no plugin definition,
  // so handle it before we go looking for one.
  if (args.command === "add-harness") {
    runAddHarness(args);
    return;
  }

  await enableTypeScript();
  const pluginPath = resolvePluginPath(args.plugin);
  let plugin: Plugin;
  try {
    plugin = await loadPlugin(pluginPath);
  } catch (err) {
    fail((err as Error).message);
  }

  // The plugin module may have registered custom harnesses at import time, so
  // validate requested targets only now that the registry is fully populated.
  validateTargets(args.targets);

  try {
    switch (args.command) {
      case "build":
        runBuild(plugin!, args, pluginPath);
        break;
      case "install":
        runInstall(plugin!, args);
        break;
      case "check":
        runCheck(plugin!);
        break;
      case "tools":
        await runTools(plugin!, args, pluginPath);
        break;
      default:
        fail(`Unknown command "${args.command}". Run --help.`);
    }
  } catch (err) {
    if (err instanceof PluginValidationError) {
      fail(err.message);
    }
    throw err;
  }
}

function runBuild(plugin: Plugin, args: Args, pluginPath: string): void {
  const outDir = args.out ?? ".aps-out";
  const builds = build(plugin, { targets: args.targets });
  // The author's tools module is copied into every output so the generated glue's
  // `./tools` import resolves with no manual step.
  const toolsContent = readToolsModule(plugin, pluginPath);
  console.log(`\n  ${bold(plugin.id)} → ${outDir}/\n`);
  for (const b of builds) {
    const root = join(process.cwd(), outDir, b.harness);
    const written = writeTree(root, b.files);
    let count = written.length;
    if (toolsContent !== null) {
      writeFileSync(join(root, "tools.ts"), toolsContent);
      count++;
    }
    const w = b.warnings.length
      ? dim(` (${b.warnings.length} warning${b.warnings.length > 1 ? "s" : ""})`)
      : "";
    console.log(`  ${tick()} ${pad(b.harness)} ${count} files${w}`);
  }

  // Surface capability gaps the way ai-sdk surfaces result.warnings — grouped,
  // explicit, never written into the artifact tree.
  const withWarnings = builds.filter((b) => b.warnings.length > 0);
  if (withWarnings.length > 0) {
    console.log(`\n  ${bold("Warnings")}`);
    for (const b of withWarnings) {
      console.log(`\n  ${b.harness}`);
      for (const w of b.warnings) {
        console.log(`    ${warn()} ${formatWarning(w)}`);
      }
    }
  }

  console.log(`\n  Built ${builds.length} harness target(s).\n`);
}

function runInstall(plugin: Plugin, args: Args): void {
  const scope = args.global ? "global" : "project";
  const installed = installSkills(plugin, {
    targets: args.targets,
    scope,
    dryRun: args.dryRun,
  });
  const verb = args.dryRun ? "Would install" : "Installed";
  console.log(`\n  ${bold(plugin.id)} — ${verb} (${scope})\n`);
  if (installed.length === 0) {
    console.log("  (no skills or commands in this plugin)\n");
    return;
  }
  for (const r of installed) {
    const dest =
      r.files.length === 0
        ? dim("(skipped)")
        : r.kind === "skill"
          ? dirname(r.files[0] ?? "")
          : r.files[0];
    const mark = r.files.length === 0 ? warn() : tick();
    console.log(
      `  ${mark} ${pad(r.harness)} ${pad6(r.kind)} ${r.name} → ${dest}`,
    );
    if (r.note) console.log(`           ${dim("↳ " + r.note)}`);
  }
  console.log("");
}

/** Read the author's tools module file, or null if the plugin has no tools. */
function readToolsModule(plugin: Plugin, pluginPath: string): string | null {
  if (!plugin.tools) return null;
  const spec = plugin.tools.module;
  const src = isAbsolute(spec) ? spec : resolve(dirname(pluginPath), spec);
  if (!existsSync(src)) {
    fail(`tools module not found: ${src} (from \`tools.module\` = "${spec}")`);
  }
  return readFileSync(src, "utf8");
}

async function runTools(
  plugin: Plugin,
  args: Args,
  pluginPath: string,
): Promise<void> {
  const tools = await loadPluginTools(plugin, pluginPath);
  if (tools.length === 0) {
    console.log("\n  (this plugin defines no tools)\n");
    return;
  }

  // Invoke one tool locally — no harness, no MCP server, no publish.
  if (args.call) {
    let parsed: Record<string, unknown> = {};
    if (args.toolArgs) {
      try {
        parsed = JSON.parse(args.toolArgs);
      } catch (err) {
        fail(`--args is not valid JSON: ${(err as Error).message}`);
      }
    }
    const result = await callTool(tools, args.call, parsed);
    const mark = result.isError ? warn() : tick();
    console.log(`\n  ${mark} ${bold(args.call)}\n`);
    console.log(contentToText(result));
    console.log("");
    if (result.isError) process.exitCode = 1;
    return;
  }

  // Otherwise, list the tools.
  console.log(`\n  ${bold(plugin.id)} — ${tools.length} tool(s)\n`);
  for (const t of listTools(tools)) {
    const params = Object.keys(
      (t.parameters.properties as Record<string, unknown>) ?? {},
    );
    console.log(`  ${tick()} ${bold(t.name)}(${params.join(", ")})`);
    console.log(`      ${dim(t.description)}`);
  }
  console.log(`\n  Invoke one:  ${dim("agent-plugin tools --call <name> --args '{…}'")}\n`);
}

function runCheck(plugin: Plugin): void {
  // build() validates; if we got here the plugin already loaded, so validate explicitly.
  build(plugin, { targets: [allHarnessIds()[0]!] });
  const skills = plugin.skills?.length ?? 0;
  const commands = plugin.commands?.length ?? 0;
  const mcp = Object.keys(plugin.mcpServers ?? {}).length;
  const agents = plugin.subagents?.length ?? 0;
  const hooks = plugin.hooks?.length ?? 0;
  const ctx = plugin.instructions?.trim() ? "with instructions" : "no instructions";
  console.log(
    `  ${tick()} ${bold(plugin.id)} is valid (${skills} skill(s), ${commands} command(s), ${agents} subagent(s), ${hooks} hook(s), ${mcp} MCP server(s), ${ctx}).`,
  );
}

/**
 * Scaffold a new harness module. The id is the second positional
 * (`agent-plugin add-harness <id>`); the file is written to `<out>/<id>.ts`.
 */
function runAddHarness(args: Args): void {
  const id = args.plugin; // positionals[1]
  const problem = validateHarnessId(id ?? "");
  if (problem) fail(problem);

  const displayName = args.name ?? deriveDisplayName(id!);
  const outDir = args.out ?? ".";
  const target = resolve(process.cwd(), outDir, `${id}.ts`);
  const content = harnessTemplate(id!, displayName);

  if (existsSync(target)) {
    fail(`Refusing to overwrite existing file: ${target}`);
  }

  if (args.dryRun) {
    console.log(`\n  ${tick()} Would write ${bold(target)}\n`);
    console.log(content);
    return;
  }

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);

  console.log(`\n  ${tick()} Created ${bold(target)}\n`);
  console.log(`  ${bold("Next steps")}`);
  console.log(`    1. Fill in the ${dim("TODO")}s: \`supports\`, \`emit\`, and install paths.`);
  console.log(`    2. Import the file so it self-registers, e.g. in your plugin:`);
  console.log(dim(`         import "./${id}.js";`));
  console.log(`    3. Build/install as usual: ${dim(`agent-plugin build -t ${id}`)}\n`);
}

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const tick = () => `\x1b[32m✓\x1b[0m`;
const warn = () => `\x1b[33m∅\x1b[0m`;
const pad = (s: string) => s.padEnd(10);
const pad6 = (s: string) => s.padEnd(7);

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
