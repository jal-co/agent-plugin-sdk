import type { Command, Hook, Plugin, Skill, Subagent } from "./types.js";
import type { Harness } from "./harnesses/types.js";

/**
 * Define a portable Agent Skill.
 *
 * A thin, fully-typed identity helper — like ai-sdk's `tool()` — that gives you
 * autocomplete and type-checking at the definition site without forcing you to
 * import and annotate the `Skill` type by hand.
 *
 * ```ts
 * const review = defineSkill({
 *   name: "diff-review",
 *   description: "Summarize and risk-flag uncommitted changes. Use when the user asks what changed or wants a commit message.",
 *   instructions: `Run \`git diff HEAD\` and summarize the changes in 2-3 bullets.`,
 * });
 * ```
 */
export function defineSkill(skill: Skill): Skill {
  return skill;
}

/**
 * Define a portable custom slash command.
 *
 * ```ts
 * const fixIssue = defineCommand({
 *   name: "fix-issue",
 *   description: "Fix a GitHub issue end to end.",
 *   argumentHint: "[issue-number]",
 *   body: `Fix issue #$1 following our coding standards, then write tests.`,
 * });
 * ```
 */
export function defineCommand(command: Command): Command {
  return command;
}

/**
 * Define a portable custom subagent.
 *
 * ```ts
 * const reviewer = defineSubagent({
 *   name: "code-reviewer",
 *   description: "Reviews code for bugs and security issues. Use after writing code.",
 *   tools: ["Read", "Grep"],
 *   prompt: "You are a meticulous code reviewer. Flag bugs, security issues, and missing tests.",
 * });
 * ```
 */
export function defineSubagent(subagent: Subagent): Subagent {
  return subagent;
}

/**
 * Define a portable lifecycle hook.
 *
 * ```ts
 * const planReview = defineHook({
 *   event: "pre-tool-use",
 *   matcher: "ExitPlanMode",
 *   command: "plannotator",
 *   timeout: 345600,
 *   // same intent, different native event on Codex:
 *   harness: { codex: { event: "Stop", matcher: undefined } },
 * });
 * ```
 */
export function defineHook(hook: Hook): Hook {
  return hook;
}

/**
 * Define a portable plugin. Author once; compile to native artifacts for every
 * supported harness with {@link build} or the `agent-plugin` CLI.
 *
 * ```ts
 * export default definePlugin({
 *   id: "git-helper",
 *   description: "Helpers for working with git in a repo.",
 *   skills: [review, commit],
 * });
 * ```
 */
export function definePlugin(plugin: Plugin): Plugin {
  return plugin;
}

/**
 * Define a custom target harness — the analog of authoring an ai-sdk provider
 * package. A thin identity helper that type-checks a {@link Harness}
 * implementation (its `supports` capability map, `emit` translator, and install
 * paths) at the definition site.
 *
 * ```ts
 * export const gemini = defineHarness({
 *   specificationVersion: "v1",
 *   id: "gemini",
 *   displayName: "Gemini CLI",
 *   supports: { instructions: true, skills: true, commands: true,
 *               subagents: false, hooks: true, mcpServers: true, tools: true },
 *   // …emit + install paths
 * });
 * ```
 */
export function defineHarness(harness: Harness): Harness {
  return harness;
}
