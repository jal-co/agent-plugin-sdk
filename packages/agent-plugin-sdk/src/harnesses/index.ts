import type { HarnessId } from "../types.js";
import type { Harness } from "./types.js";
import { FEATURES, type Feature } from "../warnings.js";
import { claude } from "./claude.js";
import { codex } from "./codex.js";
import { pi } from "./pi.js";
import { opencode } from "./opencode.js";

export const harnesses: Record<HarnessId, Harness> = {
  claude,
  codex,
  pi,
  opencode,
};

export const allHarnessIds = Object.keys(harnesses) as HarnessId[];

/**
 * The full capability matrix: `{ harness: { feature: supported } }`. Reads
 * straight off each harness's declarative `supports` map — the single source of
 * truth for docs, the CLI, and tests (no hand-maintained table).
 */
export function supportMatrix(): Record<HarnessId, Record<Feature, boolean>> {
  const out = {} as Record<HarnessId, Record<Feature, boolean>>;
  for (const id of allHarnessIds) {
    const { supports } = harnesses[id];
    out[id] = Object.fromEntries(
      FEATURES.map((f) => [f, supports[f]]),
    ) as Record<Feature, boolean>;
  }
  return out;
}

export function getHarness(id: HarnessId): Harness {
  const h = harnesses[id];
  if (!h) {
    throw new Error(
      `Unknown harness "${id}". Supported: ${allHarnessIds.join(", ")}`,
    );
  }
  return h;
}

export { claude, codex, pi, opencode };
export type { Harness, InstallScope, EmitContext } from "./types.js";
