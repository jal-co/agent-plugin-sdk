import type { HarnessId, OutputFile, Plugin } from "./types.js";
import { allHarnessIds, getHarness } from "./harnesses/index.js";
import { emitFor } from "./emit.js";
import type { BuildWarning } from "./warnings.js";
import { validatePlugin } from "./validate.js";

/** The generated artifacts for a single harness. */
export interface HarnessBuild {
  harness: HarnessId;
  /** Files relative to this harness's output root. */
  files: OutputFile[];
  /**
   * Non-fatal degradations for this target — features/options the harness can't
   * represent. The build still succeeds; the caller decides how loud to be. The
   * same "tell me what was dropped" contract as ai-sdk's `result.warnings`.
   */
  warnings: BuildWarning[];
}

export interface BuildOptions {
  /** Which harnesses to target. Defaults to all supported. */
  targets?: HarnessId[];
}

/**
 * Compile a portable plugin into in-memory artifact trees, one per target
 * harness. Pure: does not touch the filesystem — see `writeBuild` (CLI) for that.
 *
 * Validates the plugin first and throws {@link PluginValidationError} on any
 * structural problem; per-harness capability gaps surface as `warnings`, not
 * throws.
 */
export function build(plugin: Plugin, options: BuildOptions = {}): HarnessBuild[] {
  validatePlugin(plugin);
  const targets = options.targets ?? allHarnessIds();
  return targets.map((id) => {
    const { files, warnings } = emitFor(getHarness(id), plugin);
    return { harness: id, files, warnings };
  });
}
