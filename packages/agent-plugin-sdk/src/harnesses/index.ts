import type { BuiltinHarnessId, HarnessId } from "../types.js";
import type { Harness } from "./types.js";
import { FEATURES, type Feature } from "../warnings.js";
import { claude } from "./claude.js";
import { codex } from "./codex.js";
import { pi } from "./pi.js";
import { opencode } from "./opencode.js";
import { gemini } from "./gemini.js";
import { copilot } from "./copilot.js";
import { cursor } from "./cursor.js";

/**
 * The harnesses the SDK ships with. Their ids are the {@link BuiltinHarnessId}
 * union, so they always autocomplete.
 */
const builtins = [
  claude,
  codex,
  pi,
  opencode,
  gemini,
  copilot,
  cursor,
] as const;

/** The built-in harness ids, in their canonical order. */
export const builtinHarnessIds: readonly BuiltinHarnessId[] = builtins.map(
  (h) => h.id as BuiltinHarnessId,
);

/**
 * The live harness registry — our analog of ai-sdk's provider registry. Seeded
 * with the built-ins; {@link registerHarness} adds (or overrides) entries so a
 * third party can ship a harness as a separate package and plug it in without
 * forking the SDK. Insertion order is preserved (built-ins first).
 */
const registry = new Map<HarnessId, Harness>();
for (const h of builtins) registry.set(h.id, h);

/**
 * Register a custom target harness (or override a built-in). The analog of
 * installing an ai-sdk provider: once registered, the harness flows through
 * {@link build}, `installSkills`, {@link supportMatrix}, and the CLI exactly
 * like a built-in.
 *
 * Throws if the implementation declares an unknown `specificationVersion` — the
 * same guard ai-sdk applies to a mismatched provider.
 */
export function registerHarness(harness: Harness): void {
  if (harness.specificationVersion !== "v1") {
    throw new Error(
      `Cannot register harness "${harness.id}": unsupported specificationVersion ` +
        `"${(harness as { specificationVersion: string }).specificationVersion}" (expected "v1").`,
    );
  }
  if (!harness.id) {
    throw new Error("Cannot register a harness without an `id`.");
  }
  registry.set(harness.id, harness);
}

/** True if a harness with this id is registered. */
export function hasHarness(id: HarnessId): boolean {
  return registry.has(id);
}

/** Every registered harness id (built-ins plus any registered at runtime). */
export function allHarnessIds(): HarnessId[] {
  return [...registry.keys()];
}

/** Every registered harness, in registration order. */
export function listHarnesses(): Harness[] {
  return [...registry.values()];
}

/**
 * The full capability matrix: `{ harness: { feature: supported } }`. Reads
 * straight off each registered harness's declarative `supports` map — the single
 * source of truth for docs, the CLI, and tests (no hand-maintained table).
 */
export function supportMatrix(): Record<HarnessId, Record<Feature, boolean>> {
  const out = {} as Record<HarnessId, Record<Feature, boolean>>;
  for (const [id, harness] of registry) {
    out[id] = Object.fromEntries(
      FEATURES.map((f) => [f, harness.supports[f]]),
    ) as Record<Feature, boolean>;
  }
  return out;
}

/** Look up a registered harness by id, throwing a helpful error if unknown. */
export function getHarness(id: HarnessId): Harness {
  const h = registry.get(id);
  if (!h) {
    throw new Error(
      `Unknown harness "${id}". Registered: ${allHarnessIds().join(", ")}`,
    );
  }
  return h;
}

export { claude, codex, pi, opencode, gemini, copilot, cursor };
export type { Harness, InstallScope, EmitContext } from "./types.js";
