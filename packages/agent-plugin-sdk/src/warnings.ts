import type { HarnessId } from "./types.js";

/**
 * The portable feature set — the "common denominator" every plugin can declare.
 *
 * A harness declares which of these it can emit natively via its `supports` map.
 * When a plugin uses a feature a target can't represent, the build emits a
 * structured {@link BuildWarning} instead of throwing or silently dropping it —
 * the same "degrade gracefully, tell the caller what was dropped" contract as
 * ai-sdk's `LanguageModelV2CallWarning`.
 *
 * Note: `marketplace` is intentionally NOT here. It is Claude-specific
 * distribution metadata you opt into knowing it is single-target (the analog of
 * a provider-defined tool), not a portable feature one expects everywhere.
 */
export const FEATURES = [
  "instructions",
  "skills",
  "commands",
  "subagents",
  "hooks",
  "mcpServers",
  "tools",
] as const;

export type Feature = (typeof FEATURES)[number];

/**
 * A non-fatal issue produced while compiling a plugin for one harness.
 *
 * Mirrors ai-sdk's `LanguageModelV2CallWarning`: a recognized, valid input that
 * *this target can't honor* yields a warning and the build continues; only a
 * structurally invalid plugin throws (see {@link PluginValidationError}).
 *
 * - `unsupported-feature` — the harness has no native form for a whole feature
 *   (e.g. Pi has no subagents). The named items are dropped from this target.
 * - `unsupported-option` — the feature is emitted, but one field can't be
 *   represented (e.g. Codex prompts ignore a per-command `model`).
 * - `other` — anything else worth surfacing.
 */
export type BuildWarning =
  | {
      type: "unsupported-feature";
      harness: HarnessId;
      feature: Feature;
      /** The names of the dropped items, for an actionable message. */
      items?: string[];
      details: string;
    }
  | {
      type: "unsupported-option";
      harness: HarnessId;
      feature: Feature;
      /** The option that was dropped, e.g. `"model"`. */
      option: string;
      items?: string[];
      details: string;
    }
  | { type: "other"; harness: HarnessId; message: string };

/** A one-line, human-readable rendering of a warning for CLI output. */
export function formatWarning(w: BuildWarning): string {
  if (w.type === "other") return w.message;
  const items = w.items?.length ? ` (${w.items.join(", ")})` : "";
  const opt = w.type === "unsupported-option" ? ` option \`${w.option}\`` : "";
  return `${w.feature}${opt}${items}: ${w.details}`;
}
