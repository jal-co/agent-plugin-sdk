# @jalco/ap-sdk

Write an agent plugin once, ship it to every harness.

Each coding agent — Claude Code, Codex, Gemini CLI, Copilot, Cursor, Windsurf, Pi, OpenCode — has its own plugin system, file layout, and frontmatter rules. `@jalco/ap-sdk` lets you define a plugin once in TypeScript and compile it to the native installable artifacts each harness expects.

```ts
import { definePlugin, defineSkill } from "@jalco/ap-sdk";

export default definePlugin({
  id: "git-helper",
  description: "Helpers for reviewing and committing changes in a git repo.",
  skills: [
    defineSkill({
      name: "diff-review",
      description:
        "Summarize and risk-flag uncommitted changes. Use when the user asks what changed.",
      instructions:
        "Run `git diff HEAD` and summarize the changes in 2-4 bullets.",
    }),
  ],
});
```

```bash
ap-sdk build      # → .aps-out/{claude,codex,gemini,copilot,cursor,windsurf,pi,opencode}/
ap-sdk install    # → drops artifacts into your local harness dirs
```

## Install

```bash
pnpm add -D @jalco/ap-sdk
```

## What you can define

- [Instructions](https://ap-sdk.dev/docs): always-on system or project guidance for every supported harness.
- [Skills](https://ap-sdk.dev/docs): reusable skill documents with descriptions and instructions.
- [Commands](https://ap-sdk.dev/docs): slash commands or prompt commands in harnesses that support them.
- [Subagents](https://ap-sdk.dev/docs): named specialist agents with their own prompts, tools, and model hints.
- [Hooks](https://ap-sdk.dev/docs): lifecycle hooks and scripts translated to each harness' event model.
- [MCP servers](https://ap-sdk.dev/docs): MCP server config emitted in native JSON/TOML/YAML formats.
- [Shared tools](https://ap-sdk.dev/docs): real TypeScript implementations with per-harness glue.
- [Companion files](https://ap-sdk.dev/docs): files copied next to generated native artifacts.

See the [support matrix](https://ap-sdk.dev/docs/harnesses) for what each harness supports.

## Already have a plugin?

Point `ap-sdk port` at an existing Claude Code, Cursor, Codex, Gemini, Copilot, Windsurf, Pi, or OpenCode layout and it generates a portable `plugin.ts` that loads your existing files instead of inlining them.

```bash
npx ap-sdk port ./my-plugin
npx ap-sdk check ./plugin.ts
npx ap-sdk install owner/repo
```

Read the [porting guide](https://ap-sdk.dev/docs/porting), or install straight from GitHub with `ap-sdk install owner/repo`.

## Links

- [Homepage](https://ap-sdk.dev)
- [Docs](https://ap-sdk.dev/docs)
- [GitHub](https://github.com/jal-co/agent-plugin-sdk)
- [Examples](https://github.com/jal-co/agent-plugin-sdk/tree/main/packages/agent-plugin-sdk/examples)

## License

MIT · Originally by [Sahaj Jain](https://github.com/jnsahaj), continued by [Justin Levine](https://github.com/jal-co).
