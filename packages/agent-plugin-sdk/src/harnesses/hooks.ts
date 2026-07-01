import type { HarnessId, Hook, HookCommand, HookEvent } from "../types.js";
import type { EmitContext } from "./types.js";

/**
 * Portable → native event-name maps for each harness with declarative hooks.
 *
 * Maps are **partial**: a harness only lists the events it natively supports.
 * A hook whose event a harness can't represent (and that isn't remapped via the
 * `harness` override) is skipped with an `unsupported-option` warning rather than
 * emitted under a guessed native name. Claude Code is the reference and supports
 * the full portable set.
 */
export const HOOK_EVENTS = {
  claude: {
    "pre-tool-use": "PreToolUse",
    "post-tool-use": "PostToolUse",
    stop: "Stop",
    "user-prompt-submit": "UserPromptSubmit",
    "session-start": "SessionStart",
    notification: "Notification",
    "permission-request": "PermissionRequest",
    "subagent-stop": "SubagentStop",
    "pre-compact": "PreCompact",
    "session-end": "SessionEnd",
  },
  codex: {
    "pre-tool-use": "PreToolUse",
    "post-tool-use": "PostToolUse",
    stop: "Stop",
    "user-prompt-submit": "UserPromptSubmit",
    "session-start": "SessionStart",
  },
  gemini: {
    "pre-tool-use": "BeforeTool",
    "post-tool-use": "AfterTool",
    stop: "Stop",
    "user-prompt-submit": "UserPromptSubmit",
    "session-start": "SessionStart",
  },
  copilot: {
    // VS Code Copilot hooks use PascalCase event names (identical to Claude's).
    "pre-tool-use": "PreToolUse",
    "post-tool-use": "PostToolUse",
    stop: "Stop",
    "user-prompt-submit": "UserPromptSubmit",
    "session-start": "SessionStart",
  },
} satisfies Record<string, Partial<Record<HookEvent, string>>>;

export type HookHarness = keyof typeof HOOK_EVENTS;

/**
 * Resolve a hook's native event name + matcher for a harness (honoring
 * overrides). `event` is `undefined` when the harness has no native form for the
 * portable event and no `harness` override supplies one.
 */
function resolve(
  hook: Hook,
  harness: HookHarness,
): { event: string | undefined; matcher?: string } {
  const override = hook.harness?.[harness as keyof typeof hook.harness];
  const event =
    override?.event ??
    (HOOK_EVENTS[harness] as Partial<Record<HookEvent, string>>)[hook.event];
  // Use the override's matcher when the key is present (even if `undefined`, which
  // explicitly clears it — e.g. mapping a tool event to Codex's matcher-less Stop).
  const matcher =
    override && "matcher" in override ? override.matcher : hook.matcher;
  return { event, matcher };
}

/**
 * Harnesses whose hook format natively models a per-hook async / fire-and-forget
 * flag. Only Claude Code is confirmed; others degrade to synchronous with a
 * warning rather than emitting a guessed field.
 */
const ASYNC_HOOK_HARNESSES = new Set<HarnessId>(["claude"]);

/** Warn (once per hook) that a harness dropped the `async` flag. */
function warnAsync(ctx: EmitContext | undefined, harness: HarnessId): void {
  ctx?.warn({
    type: "unsupported-option",
    harness,
    feature: "hooks",
    option: "async",
    items: ["async"],
    details:
      `${harness} has no native async hook flag — the hook runs ` +
      "synchronously within its timeout.",
  });
}

/** Warn (once per hook) that a harness has no native form for this event. */
function warnEvent(
  ctx: EmitContext | undefined,
  harness: HarnessId,
  event: HookEvent,
): void {
  ctx?.warn({
    type: "unsupported-option",
    harness,
    feature: "hooks",
    option: "event",
    items: [event],
    details:
      `${harness} has no native "${event}" hook event — ` +
      "remap it with the `harness` override or drop it.",
  });
}

function bashOf(cmd: HookCommand): string {
  return typeof cmd === "string" ? cmd : cmd.bash;
}

/**
 * Build the Claude Code / Codex / Gemini style hook config — events map to an
 * array of `{ matcher?, hooks: [{ type:"command", command, timeout? }] }` groups.
 * Returns `null` when nothing maps. Pass `ctx` to surface an `unsupported-option`
 * warning for events this harness can't represent.
 */
export function buildMatcherHooks(
  hooks: Hook[],
  harness: "claude" | "codex" | "gemini",
  ctx?: EmitContext,
): Record<string, unknown> | null {
  if (hooks.length === 0) return null;
  const out: Record<string, Array<Record<string, unknown>>> = {};
  for (const hook of hooks) {
    const { event, matcher } = resolve(hook, harness);
    if (!event) {
      warnEvent(ctx, harness, hook.event);
      continue;
    }
    const inner: Record<string, unknown> = {
      type: "command",
      command: bashOf(hook.command),
    };
    if (hook.timeout !== undefined) inner.timeout = hook.timeout;
    if (hook.async) {
      if (ASYNC_HOOK_HARNESSES.has(harness)) inner.async = true;
      else warnAsync(ctx, harness);
    }
    const group: Record<string, unknown> = {};
    if (matcher) group.matcher = matcher;
    group.hooks = [inner];
    (out[event] ??= []).push(group);
  }
  return Object.keys(out).length > 0 ? { hooks: out } : null;
}

/**
 * Build the VS Code Copilot hook config — `{ hooks: { <PascalEvent>: [{ type:
 * "command", command, windows?, timeout? }] } }`. Copilot hooks are flat (no
 * matcher wrapper) and inspect `tool_name` themselves; timeouts are in seconds.
 * A portable `matcher` has no slot here, so the caller warns when one is set.
 */
export function buildCopilotHooks(
  hooks: Hook[],
  ctx?: EmitContext,
): Record<string, unknown> | null {
  if (hooks.length === 0) return null;
  const out: Record<string, Array<Record<string, unknown>>> = {};
  for (const hook of hooks) {
    const { event } = resolve(hook, "copilot");
    if (!event) {
      warnEvent(ctx, "copilot", hook.event);
      continue;
    }
    const entry: Record<string, unknown> = { type: "command" };
    if (typeof hook.command === "string") {
      entry.command = hook.command;
    } else {
      entry.command = hook.command.bash;
      if (hook.command.powershell) entry.windows = hook.command.powershell;
    }
    if (hook.timeout !== undefined) entry.timeout = hook.timeout;
    if (hook.async) warnAsync(ctx, "copilot");
    (out[event] ??= []).push(entry);
  }
  return Object.keys(out).length > 0 ? { hooks: out } : null;
}
