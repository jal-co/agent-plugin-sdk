import {
  definePlugin,
  defineSkill,
  defineCommand,
  defineSubagent,
} from "agent-plugin-sdk";

const diffReview = defineSkill({
  name: "diff-review",
  description:
    "Summarize and risk-flag uncommitted changes. Use when the user asks what changed, wants a commit message, or asks to review their working tree before committing.",
  allowedTools: ["Bash(git diff *)", "Bash(git status *)"],
  instructions: `## Goal
Give a tight, skimmable read on the current uncommitted changes.

## Steps
1. Run \`git status --short\` and \`git diff HEAD\`.
2. Summarize the changes in 2-4 bullets grouped by area.
3. Flag anything risky: secrets, large deletions, debug code, TODOs left behind.
4. If asked, propose a Conventional Commits message.

See [conventions](references/commit-style.md) for the commit format.`,
  resources: [
    {
      path: "references/commit-style.md",
      content: `# Commit style

Use Conventional Commits: \`type(scope): summary\`.
Types: feat, fix, docs, refactor, test, chore.
Keep the summary under 72 chars, imperative mood.
`,
    },
  ],
});

const commit = defineCommand({
  name: "commit",
  description:
    "Stage and commit the current changes with a Conventional Commits message.",
  argumentHint: "[scope]",
  allowedTools: ["Bash(git add *)", "Bash(git commit *)"],
  body: `Stage all changes and write a Conventional Commits message for them.
If a scope was given, use it: $1.
Full arguments: $ARGUMENTS`,
});

const prReviewer = defineSubagent({
  name: "pr-reviewer",
  description:
    "Reviews a diff for correctness, security, and missing tests. Use before opening a PR.",
  tools: ["Read", "Grep", "Bash(git diff *)"],
  prompt: `You are a meticulous PR reviewer.
Review the diff and report, grouped by severity:
- Correctness bugs and logic errors
- Security issues and leaked secrets
- Missing or weak test coverage
Be specific and cite file:line. Do not make edits.`,
});

export default definePlugin({
  id: "git-helper",
  version: "1.0.0",
  description: "Skills for reviewing and committing changes in a git repo.",
  author: { name: "Sahaj Jain" },
  license: "MIT",
  instructions: `## Git conventions
- Never commit directly to \`main\`; branch first.
- Use Conventional Commits for every message.
- Run the test suite before opening a PR.`,
  skills: [diffReview],
  commands: [commit],
  subagents: [prReviewer],
  mcpServers: {
    github: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_TOKEN: "${GITHUB_TOKEN}" },
    },
  },
});
