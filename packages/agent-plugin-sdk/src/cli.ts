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
import { fetchGithubPlugin, isGithubSpec } from "./github.js";
import { portPlugin } from "./port.js";
import { DEFAULT_PLUGIN_FILES, locatePlugin } from "./plugin-files.js";
import { PluginValidationError, validatePlugin } from "./validate.js";
import {
  harnessTemplate,
  deriveDisplayName,
  validateHarnessId,
} from "./scaffold.js";

const HELP = `ap-sdk — write a plugin once, ship it to every agent harness

Usage:
  ap-sdk build   [plugin] [options]   Compile to native artifacts under an output dir
  ap-sdk install [plugin] [options]   Install skills into local harness dirs
  ap-sdk check   [plugin]             Validate a plugin definition
  ap-sdk tools   [plugin] [options]   List the plugin's tools, or invoke one locally
  ap-sdk add-harness <id> [options]   Scaffold a new target harness module
  ap-sdk port    [dir] [options]      Generate a portable plugin.ts from an existing plugin

Arguments:
  plugin   A local plugin module (default: ./plugin.ts, ./plugin.js,
           ./ap-sdk.config.ts) or a GitHub source — owner/repo,
           github:owner/repo, or a github.com URL. Must default-export a
           definePlugin(...) result. Remote sources are fetched and checked for
           compatibility before anything is installed.
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
  --path <dir>         GitHub source: path to the plugin within the repo
  --ref <ref>          GitHub source: branch, tag, or commit (or owner/repo#ref)
  --help, -h           Show this help

Examples:
  ap-sdk build
  ap-sdk build ./my-plugin.ts -t claude,codex -o dist
  ap-sdk install -t opencode
  ap-sdk tools
  ap-sdk tools --call run_tests --args '{"pattern":"sum"}'
  ap-sdk add-harness gemini --name "Gemini CLI"
  ap-sdk install owner/repo
  ap-sdk install github:owner/repo#main -t claude
  ap-sdk check https://github.com/owner/repo --path examples/git-helper
  ap-sdk port ./my-claude-plugin
  ap-sdk port ./my-plugin --dry-run
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
  path?: string;
  ref?: string;
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
      case "--path":
        args.path = argv[++i];
        break;
      case "--ref":
        args.ref = argv[++i];
        break;
      default:
        if (a.startsWith("--target=")) args.targets = parseTargets(a.slice(9));
        else if (a.startsWith("-o=") || a.startsWith("--out="))
          args.out = a.split("=")[1];
        else if (a.startsWith("--call=")) args.call = a.slice(7);
        else if (a.startsWith("--args=")) args.toolArgs = a.slice(7);
        else if (a.startsWith("--name=")) args.name = a.slice(7);
        else if (a.startsWith("--path=")) args.path = a.slice(7);
        else if (a.startsWith("--ref=")) args.ref = a.slice(6);
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

function resolvePluginPath(explicit?: string): string {
  if (explicit) {
    const p = isAbsolute(explicit) ? explicit : resolve(process.cwd(), explicit);
    if (!existsSync(p)) fail(`Plugin file not found: ${p}`);
    return p;
  }
  const found = locatePlugin(process.cwd());
  if (found) return found;
  fail(
    `No plugin file given and none of ${DEFAULT_PLUGIN_FILES.join(", ")} found in ${process.cwd()}.\n` +
      `Pass a local path or a GitHub source: ap-sdk install ./plugin.ts | owner/repo`,
  );
}

/**
 * Enable importing TypeScript (`.ts`) plugin/tools modules directly by
 * registering the bundled `tsx` ESM loader. This lets `ap-sdk <cmd> foo.ts`
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
          `  npx tsx node_modules/.bin/ap-sdk ...\n` +
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

  // `port` reads an existing plugin directory and writes a plugin.ts; it needs
  // no plugin definition of its own.
  if (args.command === "port") {
    runPort(args);
    return;
  }

  await enableTypeScript();

  // A plugin arg that looks like a GitHub source is fetched to a temp checkout,
  // compatibility-checked, then handled like a local plugin file.
  const remote = args.plugin ? isGithubSpec(args.plugin) : false;
  let pluginPath: string;
  let sourceLabel: string | undefined;

  if (remote) {
    const spec =
      args.ref && !args.plugin!.includes("#")
        ? `${args.plugin}#${args.ref}`
        : args.plugin!;
    try {
      const fetched = await fetchGithubPlugin(spec, { path: args.path });
      pluginPath = fetched.pluginPath;
      sourceLabel = fetched.label;
      // Remove the temp checkout on any exit, including fail()/process.exit.
      process.on("exit", fetched.cleanup);
    } catch (err) {
      fail((err as Error).message);
    }
    console.log(`\n  ${tick()} Fetched ${bold(sourceLabel!)}`);
  } else {
    pluginPath = resolvePluginPath(args.plugin);
  }

  let plugin: Plugin;
  try {
    plugin = await loadPlugin(pluginPath!);
  } catch (err) {
    fail(
      remote
        ? `${sourceLabel} is not a compatible ap-sdk plugin — it failed to load.\n${(err as Error).message}`
        : (err as Error).message,
    );
  }

  // The plugin module may have registered custom harnesses at import time, so
  // validate requested targets only now that the registry is fully populated.
  validateTargets(args.targets);

  // Remote sources get an explicit compatibility gate before anything runs.
  if (remote) {
    try {
      validatePlugin(plugin!);
    } catch (err) {
      if (err instanceof PluginValidationError) {
        fail(
          `${sourceLabel} is not compatible with the ap-sdk format:\n\n${err.message}`,
        );
      }
      throw err;
    }
    printCompatibility(plugin!, sourceLabel!);
    // `check` on a remote source is exactly this compatibility report.
    if (args.command === "check") return;
  }

  try {
    switch (args.command) {
      case "build":
        runBuild(plugin!, args, pluginPath!);
        break;
      case "install":
        runInstall(plugin!, args);
        break;
      case "check":
        runCheck(plugin!);
        break;
      case "tools":
        await runTools(plugin!, args, pluginPath!);
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

/** Print the compatibility verdict + a one-line content summary for a plugin. */
function printCompatibility(plugin: Plugin, label: string): void {
  const skills = plugin.skills?.length ?? 0;
  const commands = plugin.commands?.length ?? 0;
  const agents = plugin.subagents?.length ?? 0;
  const hooks = plugin.hooks?.length ?? 0;
  const mcp = Object.keys(plugin.mcpServers ?? {}).length;
  console.log(`  ${tick()} ${bold(label)} is a compatible ap-sdk plugin`);
  console.log(
    `      ${dim(`${plugin.id} — ${skills} skill(s), ${commands} command(s), ${agents} subagent(s), ${hooks} hook(s), ${mcp} MCP server(s)`)}\n`,
  );
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
  console.log(`\n  Invoke one:  ${dim("ap-sdk tools --call <name> --args '{…}'")}\n`);
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
 * (`ap-sdk add-harness <id>`); the file is written to `<out>/<id>.ts`.
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
  console.log(`    3. Build/install as usual: ${dim(`ap-sdk build -t ${id}`)}\n`);
}

/**
 * Read an existing plugin/config directory (any harness's native layout) and
 * write a portable `plugin.ts` that loads its files. `--dry-run` prints it.
 */
function runPort(args: Args): void {
  const dir = args.plugin
    ? resolve(process.cwd(), args.plugin)
    : process.cwd();
  if (!existsSync(dir)) fail(`Directory not found: ${dir}`);

  const result = portPlugin(dir);
  const c = result.counts;
  const summary = [
    c.instructions ? "instructions" : null,
    `${c.skills} skill(s)`,
    `${c.subagents} subagent(s)`,
    `${c.commands} command(s)`,
    `${c.hooks} hook(s)`,
    `${c.companionDirs} companion dir(s)`,
  ]
    .filter(Boolean)
    .join(", ");

  if (args.dryRun) {
    console.log(`\n  ${tick()} Detected ${bold(result.detected)} — ${dim(summary)}\n`);
    console.log(result.code);
    return;
  }

  const outName = args.out ?? "plugin.ts";
  const outPath = resolve(dir, outName);
  if (existsSync(outPath)) {
    fail(
      `Refusing to overwrite ${outPath}. Pass --out <name> or --dry-run to preview.`,
    );
  }
  writeFileSync(outPath, result.code);

  console.log(`\n  ${tick()} Ported ${bold(result.detected)} → ${bold(outPath)}`);
  console.log(`      ${dim(summary)}\n`);
  console.log(`  ${bold("Next")}`);
  console.log(`    ${dim(`ap-sdk check ${outName}`)}   validate the port`);
  console.log(`    ${dim(`ap-sdk build ${outName}`)}   emit every harness\n`);
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
