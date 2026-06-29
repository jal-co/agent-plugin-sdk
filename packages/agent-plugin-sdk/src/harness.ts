/**
 * Harness-authoring toolkit — the public entrypoint for writing a *custom*
 * target harness, the analog of authoring an ai-sdk provider package.
 *
 * Import from `@jal-co/agent-plugin-sdk/harness`:
 *
 * ```ts
 * import {
 *   defineHarness,
 *   registerHarness,
 *   emitSkillDir,
 *   compact,
 *   type Harness,
 * } from "@jal-co/agent-plugin-sdk/harness";
 *
 * export const gemini = defineHarness({ ...  });
 * registerHarness(gemini);
 * ```
 *
 * Everything a harness needs — the `Harness` contract, the registry hook, and
 * the same emit/frontmatter helpers the built-ins use — lives here so an
 * external harness never has to reach into the SDK's internals.
 */

export { defineHarness } from "./define.js";
export { registerHarness, getHarness, hasHarness } from "./harnesses/index.js";

export type {
  Harness,
  EmitContext,
  InstallScope,
} from "./harnesses/types.js";
export type { Feature, BuildWarning } from "./warnings.js";
export type {
  HarnessId,
  BuiltinHarnessId,
  OutputFile,
  Plugin,
  Skill,
  Command,
  Subagent,
  Hook,
  McpServer,
} from "./types.js";

// Emit helpers — the shared building blocks every built-in harness translates with.
export {
  emitSkillDir,
  emitCommandFile,
  emitContextFile,
  contextBlock,
  codexAgentToml,
  rewriteArgsToZeroBased,
  json,
} from "./harnesses/shared.js";

// Frontmatter / record helpers.
export {
  renderFrontmatterDoc,
  compact,
  mapValues,
} from "./util/frontmatter.js";
