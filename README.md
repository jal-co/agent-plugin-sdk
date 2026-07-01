<p align="left">
  <picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/header/transparent.svg?title=agent-plugin-sdk&amp;subtitle=Write+an+agent+plugin+once%2C+ship+it+to+every+harness.+Skills%2C+commands%2C+subagents%2C+hooks%2C+MCP%2C+and+shared+tools+from+one+typescript+definition.&amp;size=wide&amp;mode=dark&amp;align=left&amp;font=jetbrains-mono&amp;watermark=true&amp;border=false" /><img alt="header" src="https://shieldcn.dev/header/transparent.svg?title=agent-plugin-sdk&amp;subtitle=Write+an+agent+plugin+once%2C+ship+it+to+every+harness.+Skills%2C+commands%2C+subagents%2C+hooks%2C+MCP%2C+and+shared+tools+from+one+typescript+definition.&amp;size=wide&amp;mode=light&amp;align=left&amp;font=jetbrains-mono&amp;watermark=true&amp;border=false" /></picture>
</p>

<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/group/npm/@jalco/ap-sdk+github/stars/jal-co/agent-plugin-sdk+github/jal-co/agent-plugin-sdk/contributors+github/jal-co/agent-plugin-sdk/license.svg" /><img alt="badge group" src="https://shieldcn.dev/group/npm/@jalco/ap-sdk+github/stars/jal-co/agent-plugin-sdk+github/jal-co/agent-plugin-sdk/contributors+github/jal-co/agent-plugin-sdk/license.svg?mode=light" /></picture>
</p>

<div align="center">

[Homepage](https://ap-sdk.dev) · [Docs](https://ap-sdk.dev/docs) · [𝕏](https://x.com/jalcowastaken)

</div>

> Originally created by Sahaj Jain ([@jnsahaj](https://github.com/jnsahaj)) and continued here with permission.

Each coding agent — Claude Code, Codex, Gemini CLI, Copilot, Cursor, Windsurf, Pi, OpenCode — has its own plugin system, file layout, and frontmatter rules. **agent-plugin-sdk** lets you define a plugin **once** in TypeScript and compiles it to the **native installable artifacts** each harness expects. No runtime, no wrapper — the output is exactly the files those harnesses load on their own.

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

## What you can define

| Field | What it becomes |
| --- | --- |
| [`instructions`](https://ap-sdk.dev/docs) | Always-on system or project guidance for every supported harness. |
| [`skills`](https://ap-sdk.dev/docs) | Reusable skill documents with descriptions and instructions. |
| [`commands`](https://ap-sdk.dev/docs) | Slash commands or prompt commands in harnesses that support them. |
| [`subagents`](https://ap-sdk.dev/docs) | Named specialist agents with their own prompts, tools, and model hints. |
| [`hooks`](https://ap-sdk.dev/docs) | Lifecycle hooks and scripts translated to each harness' event model. |
| [`mcpServers`](https://ap-sdk.dev/docs) | MCP server config emitted in native JSON/TOML/YAML formats. |
| [`tools`](https://ap-sdk.dev/docs) | Shared TypeScript tool implementations with per-harness glue. |
| [`files`](https://ap-sdk.dev/docs) | Companion files copied next to the generated native artifacts. |

See the [support matrix](https://ap-sdk.dev/docs/harnesses) for what each harness supports.

## Already have a plugin?

Point `ap-sdk port` at an existing Claude Code, Cursor, Codex, Gemini, Copilot, Windsurf, Pi, or OpenCode layout and it generates a portable `plugin.ts` that loads your existing files instead of inlining them.

```bash
npx ap-sdk port ./my-plugin
npx ap-sdk check ./plugin.ts
npx ap-sdk install owner/repo
```

Read the [porting guide](https://ap-sdk.dev/docs/porting), or install straight from GitHub with `ap-sdk install owner/repo`.

## Install

```bash
pnpm add -D @jalco/ap-sdk
```

[Docs](https://ap-sdk.dev/docs) · [Examples](https://github.com/jal-co/agent-plugin-sdk/tree/main/packages/agent-plugin-sdk/examples)

## License

[MIT](./LICENSE) · Originally by [Sahaj Jain](https://github.com/jnsahaj), continued by [Justin Levine](https://github.com/jal-co).
