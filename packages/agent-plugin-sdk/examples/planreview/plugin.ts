import {
  definePlugin,
  defineSkill,
  defineCommand,
  defineSubagent,
  defineHook,
} from "@jalco/ap-sdk";

/**
 * `planreview` — a plannotator-scale example exercising every SDK feature.
 *
 * Author once here; `ap-sdk build` compiles it to native artifacts for
 * Claude Code, Codex, Pi, and OpenCode. The shared tool logic lives in
 * `tools.ts` and is wired into each harness's runtime automatically.
 */

// ── Skills ──────────────────────────────────────────────────────────────────
const diffReview = defineSkill({
  name: "diff-review",
  description:
    "Summarize and risk-flag the current changes. Use when the user asks what changed or wants a pre-commit review.",
  allowedTools: ["Bash(git diff *)", "Bash(git status *)"],
  instructions: `## Goal
Give a tight, skimmable read on the current changes before a commit or PR.

## Steps
1. Capture the diff (the \`review_diff\` tool, or \`git diff HEAD\`).
2. Summarize in 2-4 bullets grouped by area.
3. Flag risks: secrets, large deletions, debug code, stray TODOs.

See [severity rubric](references/severity.md).`,
  resources: [
    {
      path: "references/severity.md",
      content: `# Severity rubric

- **blocker** — secrets, data loss, broken build
- **warn** — missing tests, debug code, unclear naming
- **nit** — style, comments, minor cleanups
`,
    },
  ],
});

// ── Commands (invoke the planreview CLI, then act on its output) ─────────────
const annotate = defineCommand({
  name: "planreview-annotate",
  description: "Open the annotation UI for a markdown file, then act on the feedback.",
  argumentHint: "[file]",
  allowedTools: ["Bash(planreview *)"],
  body: `## Annotate
!\`planreview annotate $ARGUMENTS\`

## Your task
The output above is the user's annotation feedback (or "approved"/"dismissed").
If approved or dismissed, acknowledge in one sentence and stop. Otherwise, address
the annotations precisely.`,
});

const review = defineCommand({
  name: "planreview-review",
  description: "Open the code review UI for the current changes, then address feedback.",
  allowedTools: ["Bash(planreview *)"],
  body: `## Review
!\`planreview review\`

## Your task
Address the reviewer's annotations above. If there were none, say so and stop.`,
});

// ── Subagents ────────────────────────────────────────────────────────────────
const prReviewer = defineSubagent({
  name: "pr-reviewer",
  description:
    "Reviews a diff for correctness, security, and missing tests. Use before opening a PR.",
  tools: ["Read", "Grep", "Bash(git diff *)"],
  // Per-harness model overrides ride the namespaced `harness` bag (the
  // providerOptions pattern): each target reads only its own typed key.
  harness: {
    claude: { model: "opus" },
    codex: { model: "gpt-5.4-mini" },
    opencode: { model: "anthropic/claude-sonnet-4" },
  },
  prompt: `You are a meticulous PR reviewer. Review the diff and report, grouped by
severity (blocker / warn / nit): correctness bugs, security issues, and missing test
coverage. Cite file:line. Do not make edits.`,
});

// ── Hooks (plan-mode review — wired differently per harness) ─────────────────
const planReviewHook = defineHook({
  event: "pre-tool-use",
  matcher: "ExitPlanMode",
  command: "planreview",
  timeout: 345600,
  comment: "Open the plan review UI when a plan is submitted.",
  // Claude intercepts the permission request; Codex reviews on Stop.
  harness: {
    claude: { event: "PermissionRequest" },
    codex: { event: "Stop", matcher: undefined },
  },
});

const improveContext = defineHook({
  event: "pre-tool-use",
  matcher: "EnterPlanMode",
  command: "planreview improve-context",
  timeout: 5,
});

// ── Plugin ────────────────────────────────────────────────────────────────────
export default definePlugin({
  id: "planreview",
  version: "1.0.0",
  description:
    "Interactive plan & code review: annotate plans and diffs in a UI, then send structured feedback to your agent.",
  author: { name: "Example Author", url: "https://example.com" },
  homepage: "https://example.com/planreview",
  license: "MIT",
  marketplace: { owner: { name: "Example Author" } },
  instructions: `## planreview
This project uses planreview for interactive plan and code review.
- Before opening a PR, run \`/planreview-review\` to get visual feedback.
- Treat returned annotations as authoritative; address each one.
- Never commit directly to \`main\`.`,
  skills: [diffReview],
  commands: [annotate, review],
  subagents: [prReviewer],
  hooks: [improveContext, planReviewHook],
  // External MCP server (declarative) + the shared custom tools (code).
  mcpServers: {
    github: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_TOKEN: "${GITHUB_TOKEN}" },
    },
  },
  tools: { module: "./tools.ts", names: ["review_diff", "annotate_file"] },
});
