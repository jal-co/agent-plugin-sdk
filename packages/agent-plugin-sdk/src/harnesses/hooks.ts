import type { Hook, HookCommand, HookEvent } from "../types.js";

/** Portable → native event-name maps for each harness with declarative hooks. */
export const HOOK_EVENTS = {
  claude: {
    "pre-tool-use": "PreToolUse",
    "post-tool-use": "PostToolUse",
    stop: "Stop",
    "user-prompt-submit": "UserPromptSubmit",
    "session-start": "SessionStart",
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
    "pre-tool-use": "preToolUse",
    "post-tool-use": "postToolUse",
    stop: "stop",
    "user-prompt-submit": "userPromptSubmit",
    "session-start": "sessionStart",
  },
} satisfies Record<string, Record<HookEvent, string>>;

export type HookHarness = keyof typeof HOOK_EVENTS;

/** Resolve a hook's native event name + matcher for a harness (honoring overrides). */
function resolve(
  hook: Hook,
  harness: HookHarness,
): { event: string; matcher?: string } {
  const override = hook.harness?.[harness as keyof typeof hook.harness];
  const event = override?.event ?? HOOK_EVENTS[harness][hook.event];
  // Use the override's matcher when the key is present (even if `undefined`, which
  // explicitly clears it — e.g. mapping a tool event to Codex's matcher-less Stop).
  const matcher =
    override && "matcher" in override ? override.matcher : hook.matcher;
  return { event, matcher };
}

function bashOf(cmd: HookCommand): string {
  return typeof cmd === "string" ? cmd : cmd.bash;
}

/**
 * Build the Claude Code / Codex / Gemini style hook config — events map to an
 * array of `{ matcher?, hooks: [{ type:"command", command, timeout? }] }` groups.
 * Returns `null` when there are no hooks.
 */
export function buildMatcherHooks(
  hooks: Hook[],
  harness: "claude" | "codex" | "gemini",
): Record<string, unknown> | null {
  if (hooks.length === 0) return null;
  const out: Record<string, Array<Record<string, unknown>>> = {};
  for (const hook of hooks) {
    const { event, matcher } = resolve(hook, harness);
    const inner: Record<string, unknown> = {
      type: "command",
      command: bashOf(hook.command),
    };
    if (hook.timeout !== undefined) inner.timeout = hook.timeout;
    const group: Record<string, unknown> = {};
    if (matcher) group.matcher = matcher;
    group.hooks = [inner];
    (out[event] ??= []).push(group);
  }
  return { hooks: out };
}

/**
 * Build the Copilot hook config — `{ version: 1, hooks: { <event>: [{ type,
 * bash, powershell?, timeoutSec?, comment? }] } }`. Copilot hooks are flat (no
 * matcher wrapper); the command itself decides what to intercept.
 */
export function buildCopilotHooks(hooks: Hook[]): Record<string, unknown> | null {
  if (hooks.length === 0) return null;
  const out: Record<string, Array<Record<string, unknown>>> = {};
  for (const hook of hooks) {
    const { event } = resolve(hook, "copilot");
    const entry: Record<string, unknown> = { type: "command" };
    if (typeof hook.command === "string") {
      entry.bash = hook.command;
    } else {
      entry.bash = hook.command.bash;
      if (hook.command.powershell) entry.powershell = hook.command.powershell;
    }
    if (hook.timeout !== undefined) entry.timeoutSec = hook.timeout;
    if (hook.comment) entry.comment = hook.comment;
    (out[event] ??= []).push(entry);
  }
  return { version: 1, hooks: out };
}
