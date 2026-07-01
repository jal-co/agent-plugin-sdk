/**
 * Portable, harness-neutral plugin definition.
 *
 * You author one of these with {@link definePlugin}. The SDK compiles it down to
 * native installable artifacts for each supported harness (Claude Code, Codex,
 * Pi, OpenCode).
 *
 * The model is deliberately a *lowest-common-denominator + escape hatches* one:
 * fields here map cleanly onto every target. Harness-specific knobs live under
 * each feature's optional `harness` overrides rather than polluting the core.
 */

/** A file emitted into a generated plugin tree, path relative to the plugin root. */
export interface OutputFile {
  /** Path relative to the harness output root, using forward slashes. */
  path: string;
  content: string;
  /** Mark `true` for scripts that must be chmod +x on install. */
  executable?: boolean;
}

/** An extra file bundled alongside a skill (a reference doc, a helper script…). */
export interface SkillResource {
  /** Path relative to the skill directory, e.g. `references/api.md` or `scripts/run.py`. */
  path: string;
  content: string;
  executable?: boolean;
}

/**
 * A portable Agent Skill.
 *
 * Every supported harness reads the Anthropic "Agent Skills" `SKILL.md` format
 * (YAML frontmatter + markdown body), so a single skill definition maps to all
 * of them. Fields that a given harness does not recognize are simply omitted
 * from that harness's generated frontmatter.
 */
export interface Skill {
  /**
   * Skill identifier. Becomes the directory name and (where supported) the
   * invocation command. Must be kebab-case: lowercase letters, digits and
   * single hyphens (`^[a-z0-9]+(-[a-z0-9]+)*$`), max 64 chars.
   */
  name: string;
  /**
   * What the skill does and, crucially, *when* it should trigger. This is the
   * text the agent reads to decide whether to load the skill, so front-load the
   * trigger conditions. Max 1024 chars (the tightest limit across harnesses).
   */
  description: string;
  /**
   * The skill body: markdown instructions the agent follows once the skill is
   * activated. Becomes everything after the frontmatter in `SKILL.md`.
   */
  instructions: string;
  /**
   * Tools the skill is pre-approved to use, e.g. `["Bash(git add *)", "Read"]`.
   * Emitted where the harness supports an `allowed-tools` frontmatter field
   * (Claude Code, Pi); ignored elsewhere.
   */
  allowedTools?: string[];
  /**
   * When `true`, the agent may not auto-invoke the skill — only the user can.
   * Emitted where supported (Pi `disable-model-invocation`); ignored elsewhere.
   */
  disableModelInvocation?: boolean;
  /** SPDX license string, surfaced in frontmatter where the harness records it. */
  license?: string;
  /** Free-form metadata map, emitted where the harness supports it (OpenCode, Pi). */
  metadata?: Record<string, string>;
  /** Extra files bundled in the skill directory and referenced from the body. */
  resources?: SkillResource[];
}

/**
 * A portable custom slash command.
 *
 * Compiles to a native command/prompt markdown file in each harness. The body is
 * a prompt template the agent runs when the command is invoked.
 *
 * ## Argument templating (portable)
 * - `$ARGUMENTS` — all arguments as one string. **Identical on every harness** —
 *   prefer this.
 * - `$1`, `$2`, … — positional args, **1-based**. Authored 1-based here (matching
 *   Codex, Pi and OpenCode); the Claude Code emitter rewrites them to Claude's
 *   0-based form automatically, so `$1` means "first argument" everywhere.
 *
 * Harnesses also support `` !`shell` `` injection and `@file` references in the
 * body (Claude Code, OpenCode); those are passed through untouched.
 */
export interface Command {
  /** Command id. Becomes the filename and the `/`-invocation name. Kebab-case. */
  name: string;
  /** One-line summary shown in the command menu / used for auto-invocation. */
  description: string;
  /** The prompt template run when the command is invoked. See argument templating above. */
  body: string;
  /** Autocomplete hint for arguments, e.g. `[issue-number]` or `<pr-url>`. */
  argumentHint?: string;
  /**
   * Tools the command is pre-approved to use while running. Emitted where the
   * harness supports it (Claude Code `allowed-tools`); ignored elsewhere.
   */
  allowedTools?: string[];
  /**
   * Per-harness overrides (model). Like {@link Subagent}, the model lives in the
   * harness-namespaced bag because only some harnesses have a per-command model
   * and their ids diverge (Claude `"sonnet"` vs OpenCode `"provider/model"`).
   * See {@link CommandHarnessOptions}.
   */
  harness?: CommandHarnessOptions;
}

/** Claude-specific command knobs. */
export interface ClaudeCommandOptions {
  /** Model alias, e.g. `"sonnet"`, `"opus"`. */
  model?: string;
}
/** OpenCode-specific command knobs. */
export interface OpenCodeCommandOptions {
  /** Model ref, e.g. `"anthropic/claude-sonnet-4"`. */
  model?: string;
}
/** Copilot-specific command (prompt file) knobs. */
export interface CopilotCommandOptions {
  /** Model name, e.g. `"GPT-5.2"` or `"Claude Sonnet 4.5"`. */
  model?: string;
  /** The agent the prompt runs under: `ask`, `agent`, `plan`, or a custom agent name. */
  agent?: string;
}

/**
 * Per-harness command overrides — the harness-namespaced escape hatch (our
 * analog of ai-sdk `providerOptions`). Only Claude Code and OpenCode have a
 * per-command model field, so only those keys exist:
 *
 * ```ts
 * harness: {
 *   claude: { model: "sonnet" },
 *   opencode: { model: "anthropic/claude-sonnet-4" },
 * }
 * ```
 */
export interface CommandHarnessOptions {
  claude?: ClaudeCommandOptions;
  opencode?: OpenCodeCommandOptions;
  copilot?: CopilotCommandOptions;
}

/**
 * Portable lifecycle hook events. Each maps to the native event name on every
 * harness that supports declarative command hooks (the SDK translates the
 * spelling, e.g. `pre-tool-use` → Claude `PreToolUse`, Copilot `preToolUse`,
 * Gemini `BeforeTool`).
 */
export type HookEvent =
  | "pre-tool-use"
  | "post-tool-use"
  | "stop"
  | "user-prompt-submit"
  | "session-start"
  | "notification"
  | "permission-request"
  | "subagent-stop"
  | "pre-compact"
  | "session-end";

/**
 * A command to run for a hook. A bare string runs on every platform; use the
 * object form to give a separate PowerShell invocation (Copilot supports this).
 */
export type HookCommand = string | { bash: string; powershell?: string };

/**
 * Per-harness hook overrides. The harness-namespaced escape hatch — our analog
 * of ai-sdk `providerOptions`: harnesses sometimes wire the *same intent* to a
 * different native event/matcher, so each target reads only its own key.
 *
 * Passing `matcher: undefined` here explicitly *clears* the matcher for that
 * target (distinct from omitting the key, which inherits the portable matcher).
 */
export interface HookHarnessOptions {
  /** Native event name to use for this harness instead of the portable one. */
  event?: string;
  /** Native matcher to use for this harness (or `undefined` to clear it). */
  matcher?: string;
}

/**
 * A portable lifecycle hook: run a shell command when an agent event fires.
 *
 * Compiles to each harness's native declarative hook config (Claude/Codex
 * `hooks.json`, Copilot `hooks.json`, Gemini settings snippet). Harnesses whose
 * hooks are code-only (Pi `pi.on`, OpenCode plugin callbacks) get a note instead
 * of a broken artifact.
 *
 * Because harnesses sometimes wire the *same intent* to different events (e.g.
 * plan review is Claude `PermissionRequest`/`ExitPlanMode` but Codex `Stop`), the
 * `harness` map lets you override the event/matcher per target.
 */
export interface Hook {
  /** Which lifecycle event triggers the hook. */
  event: HookEvent;
  /** Tool-name (or pattern) to match for tool events, e.g. `ExitPlanMode`. */
  matcher?: string;
  /** The shell command to run. */
  command: HookCommand;
  /** Timeout in seconds. */
  timeout?: number;
  /** Optional human note recorded as a comment where the format allows it. */
  comment?: string;
  /**
   * Per-harness overrides for event/matcher divergence. e.g. map the same hook
   * to Claude's `PermissionRequest` + `ExitPlanMode` and Codex's `Stop`. The
   * harness-namespaced escape hatch — each target reads only its own key.
   */
  harness?: Partial<Record<HarnessId, HookHarnessOptions>>;
}

/** A local MCP server launched as a subprocess (stdio transport). */
export interface McpStdioServer {
  transport?: "stdio";
  /** Executable to run, e.g. `npx` or an absolute path. */
  command: string;
  args?: string[];
  /** Literal environment variables passed to the server process. */
  env?: Record<string, string>;
  cwd?: string;
}

/** A remote MCP server reached over streamable HTTP. */
export interface McpHttpServer {
  transport: "http";
  url: string;
  /** Static request headers, e.g. `{ Authorization: "Bearer ..." }`. */
  headers?: Record<string, string>;
}

/**
 * A portable MCP server definition.
 *
 * Compiles to each harness's native MCP config shape (Claude `.mcp.json`, Codex
 * `.mcp.json`, OpenCode `opencode.json` `mcp` key). **Pi has no native MCP** — the
 * build emits an `unsupported-feature` warning for Pi rather than a broken artifact.
 */
export type McpServer = McpStdioServer | McpHttpServer;

/** OpenCode agent mode: switch to directly, be delegated to, or both. */
export type SubagentMode = "primary" | "subagent" | "all";

/** Claude-specific subagent knobs. */
export interface ClaudeSubagentOptions {
  /** Model alias, e.g. `"opus"`, `"sonnet"`, `"haiku"`. */
  model?: string;
}
/** Codex-specific subagent knobs. */
export interface CodexSubagentOptions {
  /** Model id, e.g. `"gpt-5.4-mini"`. */
  model?: string;
}
/** OpenCode-specific subagent knobs. */
export interface OpenCodeSubagentOptions {
  /** Model ref, e.g. `"anthropic/claude-sonnet-4"`. */
  model?: string;
  /** Agent mode. Defaults to `"subagent"`. */
  mode?: SubagentMode;
}
/** Copilot-specific subagent (custom agent) knobs. */
export interface CopilotSubagentOptions {
  /** Model name, e.g. `"GPT-5.2"` or `"Claude Sonnet 4.5"`. */
  model?: string;
}
/** Gemini-specific subagent knobs. */
export interface GeminiSubagentOptions {
  /** Model id, e.g. `"gemini-3-flash-preview"`. Defaults to the session model. */
  model?: string;
  /** Model temperature (0.0–2.0). */
  temperature?: number;
  /** Maximum agent turns before the subagent must report back. */
  maxTurns?: number;
}

/**
 * Per-harness subagent overrides — the harness-namespaced escape hatch (our
 * analog of ai-sdk `providerOptions`). Model ids and modes are inherently
 * provider-scoped, so each target reads only its own typed key:
 *
 * ```ts
 * harness: {
 *   claude: { model: "opus" },
 *   codex: { model: "gpt-5.4-mini" },
 *   opencode: { model: "anthropic/claude-sonnet-4", mode: "primary" },
 * }
 * ```
 */
export interface SubagentHarnessOptions {
  claude?: ClaudeSubagentOptions;
  codex?: CodexSubagentOptions;
  opencode?: OpenCodeSubagentOptions;
  gemini?: GeminiSubagentOptions;
  copilot?: CopilotSubagentOptions;
}

/**
 * A portable custom subagent — a specialized agent the harness can delegate to.
 *
 * Compiles to each harness's native agent file (Claude `.md`, Codex `.toml`,
 * OpenCode `.md`). **Pi has no subagent concept** (an explicit design choice), so
 * the build emits an `unsupported-feature` warning instead of a broken artifact.
 */
export interface Subagent {
  /** Agent id. Becomes the filename and (where supported) the `@`-mention name. Kebab-case. */
  name: string;
  /** What the agent does and when to delegate to it — drives auto-delegation. */
  description: string;
  /** The agent's system prompt (Claude/OpenCode body; Codex `developer_instructions`). */
  prompt: string;
  /** Tools the agent may use, e.g. `["Read", "Grep"]`. Emitted where supported (Claude). */
  tools?: string[];
  /**
   * Per-harness overrides (model, mode). Omit to let the agent inherit the
   * session model. See {@link SubagentHarnessOptions}.
   */
  harness?: SubagentHarnessOptions;
}

/** Author/publisher info recorded in generated plugin manifests. */
export interface PluginAuthor {
  name: string;
  email?: string;
  url?: string;
}

/**
 * Distribution metadata for a Claude Code marketplace. When present, the Claude
 * target also emits a `.claude-plugin/marketplace.json` so the plugin can be
 * added with `/plugin marketplace add <repo>`.
 */
export interface Marketplace {
  /** Marketplace owner shown in the listing. */
  owner: PluginAuthor;
  /**
   * Source path the marketplace entry points at (where the plugin's
   * `.claude-plugin/plugin.json` lives), relative to the marketplace file.
   * Defaults to `"."`.
   */
  source?: string;
}

/**
 * The top-level portable plugin. Author this once; compile it everywhere.
 */
export interface Plugin {
  /**
   * Plugin id. Used as the generated package/plugin name. Must be kebab-case
   * (`^[a-z0-9]+(-[a-z0-9]+)*$`) — every target requires this for the package name.
   */
  id: string;
  /** Semver version string recorded in generated manifests. Defaults to `0.0.0`. */
  version?: string;
  /** One-line summary of the plugin, recorded in every generated manifest. */
  description: string;
  /**
   * Always-on context for the agent — compiled to the harness's native
   * instruction file (`CLAUDE.md` for Claude Code; `AGENTS.md` for Codex, Pi,
   * OpenCode). Markdown. Installed as an id-keyed block so it merges idempotently
   * with an existing instruction file and coexists with other plugins' blocks.
   */
  instructions?: string;
  author?: PluginAuthor;
  homepage?: string;
  license?: string;
  /** Optional Claude marketplace distribution metadata. */
  marketplace?: Marketplace;
  /** Agent Skills shipped by this plugin. */
  skills?: Skill[];
  /** Custom slash commands shipped by this plugin. */
  commands?: Command[];
  /** MCP servers bundled by this plugin, keyed by server name. */
  mcpServers?: Record<string, McpServer>;
  /** Custom subagents shipped by this plugin. */
  subagents?: Subagent[];
  /** Lifecycle command hooks shipped by this plugin. */
  hooks?: Hook[];
  /**
   * Custom tools whose handlers are real code, shared across harnesses via the
   * runtime adapters. Point at a module that default-exports an array of
   * `defineTool(...)` results; the SDK generates the per-harness glue (an MCP
   * server for Claude/Codex, a native extension/plugin for Pi/OpenCode).
   */
  tools?: ToolsModule;
}

/** Reference to an author-written tools module (default-exports `Tool[]`). */
export interface ToolsModule {
  /**
   * Path to the TypeScript tools module, relative to the plugin definition file,
   * e.g. `./tools.ts`. The build **copies this file into each harness output**
   * (as `tools.ts`) and the generated glue imports it, so there is no manual copy
   * step and the import always resolves.
   */
  module: string;
  /** Tool names, for listing and validation (optional). */
  names?: string[];
}

/** Identifiers for the harnesses the SDK ships with out of the box. */
export type BuiltinHarnessId =
  | "claude"
  | "codex"
  | "pi"
  | "opencode"
  | "gemini"
  | "copilot"
  | "cursor"
  | "windsurf";

/**
 * A target harness identifier. Built-in ids autocomplete; the `(string & {})`
 * arm keeps the literal suggestions while still accepting an arbitrary id from
 * an externally registered harness (see `registerHarness`). This is the same
 * "open union" trick ai-sdk uses for provider/model ids.
 */
export type HarnessId = BuiltinHarnessId | (string & {});
