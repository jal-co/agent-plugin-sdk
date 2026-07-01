import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { parse as parseYaml } from "yaml";
import { HOOK_EVENTS } from "./harnesses/hooks.js";
import type { HookEvent } from "./types.js";
import { stripFrontmatter } from "./util/read.js";

/** A native hook event name → its portable form (built off Claude, the reference). */
const NATIVE_TO_PORTABLE = Object.fromEntries(
  Object.entries(HOOK_EVENTS.claude).map(([portable, native]) => [
    native,
    portable,
  ]),
) as Record<string, HookEvent>;

/** Directory names that are structural, not companion content. */
const NON_COMPANION = new Set([
  ".git",
  ".github",
  "node_modules",
  ".claude",
  ".claude-plugin",
  ".codex",
  ".gemini",
  ".cursor",
  ".windsurf",
  ".opencode",
  ".pi",
  ".serena",
  ".vscode",
  "agents",
  "commands",
  "skills",
  "hooks",
  "generated",
  ".aps-out",
]);

export interface PortResult {
  /** The generated `plugin.ts` source. */
  code: string;
  /** The detected source layout, for reporting. */
  detected: string;
  counts: {
    skills: number;
    commands: number;
    subagents: number;
    hooks: number;
    companionDirs: number;
    instructions: boolean;
  };
}

interface Frontmatter {
  data: Record<string, unknown>;
  body: string;
}

function splitFrontmatter(text: string): Frontmatter {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: text };
  let data: Record<string, unknown> = {};
  try {
    data = (parseYaml(m[1]!) as Record<string, unknown>) ?? {};
  } catch {
    data = {};
  }
  return { data, body: stripFrontmatter(text) };
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile()) out.push(join(dir, entry.name));
  }
  return out;
}

/** Recursively collect files matching a predicate (skips heavy/ignored dirs). */
function walk(dir: string, keep: (abs: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs, keep));
    else if (entry.isFile() && keep(abs)) out.push(abs);
  }
  return out;
}

function firstExisting(dir: string, names: string[]): string | null {
  for (const n of names) {
    const p = join(dir, n);
    if (existsSync(p)) return p;
  }
  return null;
}

/** Kebab-case a name so it's a valid skill/command/subagent id. */
function kebab(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/\.prompt$|\.agent$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

const rel = (root: string, abs: string) =>
  `./${abs.slice(root.length).replace(/^[/\\]+/, "").replaceAll("\\", "/")}`;

const lit = (v: unknown) => JSON.stringify(v);

/**
 * Read an existing plugin/config directory in any harness's native layout and
 * generate a portable `definePlugin` source that **loads its files** (never
 * inlines) via `read` / `readBody` / `readDir`.
 */
export function portPlugin(dir: string): PortResult {
  const detected = detect(dir);

  // ── Manifest ────────────────────────────────────────────────────────────
  const manifest = readManifest(dir);
  const id = kebab(manifest.name ?? basename(dir));
  const description =
    manifest.description ?? "Ported plugin. Describe what it does.";

  // ── Instructions ────────────────────────────────────────────────────────
  const instructionsFile = firstExisting(dir, [
    "CLAUDE.md",
    "AGENTS.md",
    "GEMINI.md",
    join(".github", "copilot-instructions.md"),
  ]);

  // ── Skills (SKILL.md anywhere) ──────────────────────────────────────────
  const skillFiles = walk(dir, (f) => basename(f).toLowerCase() === "skill.md");

  // ── Commands / prompts ──────────────────────────────────────────────────
  const commandFiles = [
    ...listFiles(join(dir, "commands")),
    ...listFiles(join(dir, ".codex", "prompts")),
    ...listFiles(join(dir, ".github", "prompts")),
  ].filter((f) => /\.(md|prompt\.md)$/i.test(f));

  // ── Subagents ───────────────────────────────────────────────────────────
  const agentFiles = [
    ...listFiles(join(dir, "agents")),
    ...listFiles(join(dir, ".gemini", "agents")),
    ...listFiles(join(dir, ".github", "agents")),
  ].filter((f) => /\.(md|agent\.md)$/i.test(f));

  // ── Hooks ───────────────────────────────────────────────────────────────
  const hooks = readHooks(dir);

  // ── Companion dirs (top-level content dirs the instructions reference) ───
  const companionDirs = existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !NON_COMPANION.has(e.name))
        .map((e) => e.name)
    : [];
  const hooksScriptDir = existsSync(join(dir, "hooks"))
    ? listFiles(join(dir, "hooks")).some((f) => !f.endsWith(".json"))
    : false;

  // ── Generate ──────────────────────────────────────────────────────────────
  const code = generate({
    id,
    description,
    version: manifest.version,
    author: manifest.author,
    instructionsRel: instructionsFile ? rel(dir, instructionsFile) : null,
    skills: skillFiles.map((f) => ({ ...parseSkill(f), rel: rel(dir, f) })),
    commands: commandFiles.map((f) => ({ ...parseCommand(f), rel: rel(dir, f) })),
    subagents: agentFiles
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({ ...parseAgent(f), rel: rel(dir, f) })),
    hooks,
    companionDirs: [
      ...(hooksScriptDir ? ["hooks"] : []),
      ...companionDirs,
    ],
  });

  return {
    code,
    detected,
    counts: {
      skills: skillFiles.length,
      commands: commandFiles.length,
      subagents: agentFiles.filter((f) => f.endsWith(".md")).length,
      hooks: hooks.length,
      companionDirs: (hooksScriptDir ? 1 : 0) + companionDirs.length,
      instructions: instructionsFile != null,
    },
  };
}

function detect(dir: string): string {
  if (existsSync(join(dir, ".claude-plugin"))) return "Claude Code plugin";
  if (existsSync(join(dir, "gemini-extension.json"))) return "Gemini CLI extension";
  if (existsSync(join(dir, "opencode.json"))) return "OpenCode plugin";
  if (existsSync(join(dir, ".github", "copilot-instructions.md")))
    return "GitHub Copilot";
  if (existsSync(join(dir, ".cursor"))) return "Cursor";
  if (existsSync(join(dir, ".windsurf"))) return "Windsurf";
  if (existsSync(join(dir, ".codex")) || existsSync(join(dir, ".agents")))
    return "Codex";
  if (existsSync(join(dir, ".pi"))) return "Pi";
  return "generic (skills / commands / agents / instructions)";
}

interface Manifest {
  name?: string;
  description?: string;
  version?: string;
  author?: { name: string };
}

function readManifest(dir: string): Manifest {
  const candidates = [
    join(dir, ".claude-plugin", "plugin.json"),
    join(dir, "gemini-extension.json"),
    join(dir, "opencode.json"),
    join(dir, "package.json"),
  ];
  for (const c of candidates) {
    if (!existsSync(c)) continue;
    try {
      const j = JSON.parse(readFileSync(c, "utf8"));
      const name = j.name as string | undefined;
      const author =
        typeof j.author === "string"
          ? { name: j.author }
          : j.author?.name
            ? { name: j.author.name as string }
            : undefined;
      return {
        name,
        description: (j.description ?? j.metadata?.description) as string,
        version: (j.version ?? j.metadata?.version) as string,
        author,
      };
    } catch {
      // try next
    }
  }
  return {};
}

function parseSkill(file: string) {
  const { data } = splitFrontmatter(readFileSync(file, "utf8"));
  const known = new Set([
    "name",
    "description",
    "allowed-tools",
    "allowedtools",
    "license",
  ]);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!known.has(k.toLowerCase())) extra[k] = v;
  }
  return {
    name: kebab((data.name as string) ?? basename(file)),
    description: (data.description as string) ?? "Describe when to use this skill.",
    allowedTools: toolList(data["allowed-tools"] ?? data.allowedTools),
    frontmatter: Object.keys(extra).length ? extra : undefined,
  };
}

function parseCommand(file: string) {
  const { data } = splitFrontmatter(readFileSync(file, "utf8"));
  return {
    name: kebab((data.name as string) ?? basename(file)),
    description: (data.description as string) ?? "Describe the command.",
    argumentHint: (data["argument-hint"] ?? data.argumentHint) as
      | string
      | undefined,
    allowedTools: toolList(data["allowed-tools"] ?? data.allowedTools),
  };
}

function parseAgent(file: string) {
  const { data } = splitFrontmatter(readFileSync(file, "utf8"));
  const known = new Set([
    "name",
    "description",
    "model",
    "tools",
    "color",
  ]);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!known.has(k.toLowerCase())) extra[k] = v;
  }
  return {
    name: kebab((data.name as string) ?? basename(file)),
    description: (data.description as string) ?? "Describe when to delegate.",
    tools: toolList(data.tools),
    model: data.model as string | undefined,
    frontmatter: Object.keys(extra).length ? extra : undefined,
  };
}

function toolList(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string")
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return undefined;
}

interface PortedHook {
  event: HookEvent;
  nativeEvent: string;
  matcher?: string;
  command: string;
  timeout?: number;
}

function readHooks(dir: string): PortedHook[] {
  const src =
    firstExisting(dir, [
      join("hooks", "hooks.json"),
      "hooks.json",
      join(".claude", "settings.json"),
    ]) ?? null;
  if (!src) return [];
  let root: Record<string, unknown>;
  try {
    root = JSON.parse(readFileSync(src, "utf8"));
  } catch {
    return [];
  }
  const groups = (root.hooks ?? {}) as Record<string, unknown>;
  const out: PortedHook[] = [];
  for (const [nativeEvent, entries] of Object.entries(groups)) {
    const portable = NATIVE_TO_PORTABLE[nativeEvent];
    for (const group of (entries as Record<string, unknown>[]) ?? []) {
      const matcher = group.matcher as string | undefined;
      for (const h of (group.hooks as Record<string, unknown>[]) ?? [group]) {
        const command = (h.command ?? group.command) as string | undefined;
        if (!command) continue;
        out.push({
          event: portable ?? "stop",
          nativeEvent,
          matcher,
          command,
          timeout: (h.timeout ?? group.timeout) as number | undefined,
        });
      }
    }
  }
  return out;
}

interface GenInput {
  id: string;
  description: string;
  version?: string;
  author?: { name: string };
  instructionsRel: string | null;
  skills: (ReturnType<typeof parseSkill> & { rel: string })[];
  commands: (ReturnType<typeof parseCommand> & { rel: string })[];
  subagents: (ReturnType<typeof parseAgent> & { rel: string })[];
  hooks: PortedHook[];
  companionDirs: string[];
}

function generate(p: GenInput): string {
  const L: string[] = [];
  L.push(`import {`);
  L.push(`  definePlugin,`);
  if (p.skills.length) L.push(`  defineSkill,`);
  if (p.commands.length) L.push(`  defineCommand,`);
  if (p.subagents.length) L.push(`  defineSubagent,`);
  if (p.hooks.length) L.push(`  defineHook,`);
  L.push(`  readTextFrom,`);
  if (p.skills.length || p.commands.length || p.subagents.length)
    L.push(`  readBodyFrom,`);
  if (p.companionDirs.length) L.push(`  readDir,`);
  L.push(`} from "@jalco/ap-sdk";`);
  L.push(``);
  L.push(`const read = readTextFrom(import.meta.url);`);
  if (p.skills.length || p.commands.length || p.subagents.length)
    L.push(`const readBody = readBodyFrom(import.meta.url);`);
  L.push(``);
  L.push(`export default definePlugin({`);
  L.push(`  id: ${lit(p.id)},`);
  L.push(`  description: ${lit(p.description)},`);
  if (p.version) L.push(`  version: ${lit(p.version)},`);
  if (p.author) L.push(`  author: { name: ${lit(p.author.name)} },`);
  if (p.instructionsRel)
    L.push(`  instructions: read(${lit(p.instructionsRel)}),`);

  if (p.skills.length) {
    L.push(`  skills: [`);
    for (const s of p.skills) {
      L.push(`    defineSkill({`);
      L.push(`      name: ${lit(s.name)},`);
      L.push(`      description: ${lit(s.description)},`);
      if (s.allowedTools) L.push(`      allowedTools: ${lit(s.allowedTools)},`);
      if (s.frontmatter) L.push(`      frontmatter: ${lit(s.frontmatter)},`);
      L.push(`      instructions: readBody(${lit(s.rel)}),`);
      L.push(`    }),`);
    }
    L.push(`  ],`);
  }

  if (p.subagents.length) {
    L.push(`  subagents: [`);
    for (const a of p.subagents) {
      L.push(`    defineSubagent({`);
      L.push(`      name: ${lit(a.name)},`);
      L.push(`      description: ${lit(a.description)},`);
      if (a.tools) L.push(`      tools: ${lit(a.tools)},`);
      if (a.model)
        L.push(`      harness: { claude: { model: ${lit(a.model)} } },`);
      if (a.frontmatter) L.push(`      frontmatter: ${lit(a.frontmatter)},`);
      L.push(`      prompt: readBody(${lit(a.rel)}),`);
      L.push(`    }),`);
    }
    L.push(`  ],`);
  }

  if (p.commands.length) {
    L.push(`  commands: [`);
    for (const c of p.commands) {
      L.push(`    defineCommand({`);
      L.push(`      name: ${lit(c.name)},`);
      L.push(`      description: ${lit(c.description)},`);
      if (c.argumentHint) L.push(`      argumentHint: ${lit(c.argumentHint)},`);
      if (c.allowedTools) L.push(`      allowedTools: ${lit(c.allowedTools)},`);
      L.push(`      body: readBody(${lit(c.rel)}),`);
      L.push(`    }),`);
    }
    L.push(`  ],`);
  }

  if (p.hooks.length) {
    L.push(`  hooks: [`);
    for (const h of p.hooks) {
      const parts = [`event: ${lit(h.event)}`];
      if (h.matcher) parts.push(`matcher: ${lit(h.matcher)}`);
      parts.push(`command: ${lit(h.command)}`);
      if (h.timeout !== undefined) parts.push(`timeout: ${h.timeout}`);
      const note =
        NATIVE_TO_PORTABLE[h.nativeEvent] === undefined
          ? ` // TODO: native "${h.nativeEvent}" had no portable event; defaulted`
          : "";
      L.push(`    defineHook({ ${parts.join(", ")} }),${note}`);
    }
    L.push(`  ],`);
  }

  if (p.companionDirs.length) {
    L.push(`  files: [`);
    for (const d of p.companionDirs) {
      L.push(`    ...readDir(${lit(`./${d}`)}, import.meta.url, ${lit(d)}),`);
    }
    L.push(`  ],`);
  }

  L.push(`});`);
  L.push(``);
  return L.join("\n");
}
