import type { OutputFile, Plugin } from "./types.js";
import type { EmitContext, Harness } from "./harnesses/types.js";
import { FEATURES, type BuildWarning, type Feature } from "./warnings.js";

/** The result of compiling one plugin for one harness. */
export interface EmitResult {
  files: OutputFile[];
  warnings: BuildWarning[];
}

/** Names of the items a plugin declares for a feature (for warning messages). */
const featureItems: Record<Feature, (p: Plugin) => string[]> = {
  instructions: (p) => (p.instructions?.trim() ? ["instructions"] : []),
  skills: (p) => (p.skills ?? []).map((s) => s.name),
  commands: (p) => (p.commands ?? []).map((c) => c.name),
  subagents: (p) => (p.subagents ?? []).map((a) => a.name),
  hooks: (p) =>
    (p.hooks ?? []).map((h) => `${h.event}${h.matcher ? `:${h.matcher}` : ""}`),
  mcpServers: (p) => Object.keys(p.mcpServers ?? {}),
  tools: (p) => (p.tools ? (p.tools.names ?? ["tools"]) : []),
};

/** Clear a single feature off a (shallow-cloned) plugin. */
function stripFeature(p: Plugin, feature: Feature): void {
  switch (feature) {
    case "instructions":
      p.instructions = undefined;
      break;
    case "skills":
      p.skills = undefined;
      break;
    case "commands":
      p.commands = undefined;
      break;
    case "subagents":
      p.subagents = undefined;
      break;
    case "hooks":
      p.hooks = undefined;
      break;
    case "mcpServers":
      p.mcpServers = undefined;
      break;
    case "tools":
      p.tools = undefined;
      break;
  }
}

/**
 * Compile a plugin for one harness — the single driver both `build` and
 * `install` go through.
 *
 * The "common denominator + bespoke" logic lives *here*, not in the harnesses:
 *
 * 1. **Capability gating.** For each portable {@link Feature} the plugin uses,
 *    if the harness's `supports` map says it can't be represented, the feature
 *    is stripped from the plugin handed to the emitter and a structured
 *    `unsupported-feature` {@link BuildWarning} is recorded. No throw, no silent
 *    drop, no NOTE file in the output — exactly ai-sdk's `warnings[]` contract.
 * 2. **Pure translation.** The harness's `emit` only ever sees features it
 *    supports, so it is a straight portable→native translator. It may still push
 *    finer `unsupported-option` warnings through `ctx.warn`.
 */
export function emitFor(harness: Harness, plugin: Plugin): EmitResult {
  const warnings: BuildWarning[] = [];
  const projected: Plugin = { ...plugin };

  for (const feature of FEATURES) {
    const items = featureItems[feature](plugin);
    if (items.length === 0) continue;
    if (!harness.supports[feature]) {
      warnings.push({
        type: "unsupported-feature",
        harness: harness.id,
        feature,
        items: feature === "instructions" ? undefined : items,
        details:
          harness.unsupportedDetails?.[feature] ??
          `${harness.displayName} has no native support for ${feature}.`,
      });
      stripFeature(projected, feature);
    }
  }

  const ctx: EmitContext = { warn: (w) => warnings.push(w) };
  const files = harness.emit(projected, ctx);
  return { files, warnings };
}
