import type { HarnessId, Hook, McpServer, OutputFile, Plugin } from "../types.js";
import type { BuildWarning, Feature } from "../warnings.js";

/** Where a generated artifact gets installed for a given install scope. */
export type InstallScope = "project" | "global";

/**
 * Context handed to a harness's {@link Harness.emit}. The emitter receives a
 * plugin already projected down to the features this harness supports (the
 * driver in `emit.ts` strips and warns about unsupported features centrally), so
 * `emit` is a *pure translator* — it never decides what it can't do.
 *
 * `warn` is for the finer, option-level case: a feature is emitted, but one
 * field can't be represented (e.g. a per-command model on a harness whose
 * prompts have no model field). Mirrors how an ai-sdk provider pushes a
 * `LanguageModelV2CallWarning` for an unsupported setting.
 */
export interface EmitContext {
  warn(warning: BuildWarning): void;
}

/**
 * A target harness — our analog of an ai-sdk `ProviderV2`. Each implementation
 * owns *all* knowledge about one harness: which portable features it supports,
 * how to translate them into native files, and where those files get installed.
 *
 * The version-suffixed contract (`specificationVersion`) lets the driver detect
 * a mismatched implementation, the way ai-sdk gates on `specificationVersion`.
 */
export interface Harness {
  /** Spec version this harness implements. Bumped on a breaking spec change. */
  readonly specificationVersion: "v1";
  readonly id: HarnessId;
  /** Human-readable name for CLI output. */
  readonly displayName: string;

  /**
   * The capability map: which portable {@link Feature}s this harness can emit
   * natively. The single declarative source of truth for common-vs-bespoke —
   * the driver consults it to decide emit-or-warn, and docs/tests read it as the
   * support matrix. (ai-sdk's analog is per-model capability data like
   * `supportedUrls`.)
   */
  readonly supports: Readonly<Record<Feature, boolean>>;

  /**
   * Optional per-feature explanation used in an `unsupported-feature` warning,
   * telling the author what to do instead (e.g. "Pi hooks are TypeScript…").
   * Falls back to a generic message when absent.
   */
  readonly unsupportedDetails?: Partial<Record<Feature, string>>;

  /**
   * Translate a (already-validated, already feature-projected) plugin into a
   * native artifact tree. Returned paths are relative to this harness's output
   * root (`<outDir>/<id>/`). Use `ctx.warn` for option-level degradation.
   */
  emit(plugin: Plugin, ctx: EmitContext): OutputFile[];

  /**
   * The directory a generated skill should be copied into when installing
   * locally. `name` is the skill name. Returns an absolute path.
   */
  skillInstallDir(scope: InstallScope, name: string): string;

  /**
   * Base directory the plugin's companion files (`plugin.files`) install into
   * for this scope — the local analog of the built plugin root. Each file lands
   * at `join(<dir>, file.path)`. Return `null`, or omit the method entirely, when
   * the harness has no sensible home for them (they still ship in the build
   * tree). Optional so harnesses authored before this existed keep working.
   */
  filesInstallDir?(scope: InstallScope): string | null;

  /**
   * Absolute path of the `<name>.md` file a generated command installs to, or
   * `null` if this harness cannot install commands at the requested scope.
   */
  commandInstallPath(scope: InstallScope, name: string): string | null;

  /**
   * True when this harness only supports global (home-dir) command install —
   * e.g. Codex custom prompts live in `~/.codex/prompts/` and are never
   * project-scoped. Used to warn when a project install is requested.
   */
  readonly commandsGlobalOnly?: boolean;

  /**
   * How MCP servers merge into a standalone (non-plugin) config file for this
   * harness, or `null` when MCP can't be installed standalone (Codex: must ship
   * inside a bundled plugin; Pi: no native MCP). Returns the target config path,
   * the JSON key to merge servers under, and the native entry converter.
   */
  mcpInstall(scope: InstallScope): {
    path: string;
    mergeKey: string;
    convert: (server: McpServer) => Record<string, unknown>;
    /** Extra top-level keys to set if the file is created fresh (e.g. $schema). */
    defaults?: Record<string, unknown>;
  } | null;

  /** Human-readable reason MCP can't be installed standalone, when `mcpInstall` is null. */
  readonly mcpInstallNote?: string;

  /** Native instruction filename for this harness: `CLAUDE.md` or `AGENTS.md`. */
  readonly contextFileName: string;

  /** Absolute path of the instruction file plugin context merges into. */
  contextInstallPath(scope: InstallScope): string;

  /**
   * Absolute path the generated subagent file installs to, or `null` if this
   * harness has no subagent concept (Pi). Includes the right extension.
   */
  subagentInstallPath(scope: InstallScope, name: string): string | null;

  /** Reason subagents can't be installed, when `subagentInstallPath` is null. */
  readonly subagentNote?: string;

  /**
   * Build this harness's native hook config (`{ hooks: { … } }`) from portable
   * hooks, or `null` if the harness has no declarative hooks (Pi, OpenCode).
   */
  buildHookConfig(hooks: Hook[]): { hooks: Record<string, unknown[]> } | null;

  /**
   * The config file hooks merge into for a standalone install (Claude
   * `settings.json`, Codex `hooks.json`), or `null` when hooks are code-only.
   */
  hookInstall(scope: InstallScope): string | null;

  /** Reason hooks can't be installed declaratively, when `hookInstall` is null. */
  readonly hookInstallNote?: string;
}
