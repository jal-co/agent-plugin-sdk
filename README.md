<p align="left">
  <picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/header/transparent.svg?title=agent-plugin-sdk&amp;subtitle=Write+an+agent+plugin+once%2C+ship+it+to+every+harness.+Skills%2C+commands%2C+subagents%2C+hooks%2C+MCP%2C+and+shared+tools+from+one+typescript+definition.&amp;size=wide&amp;mode=dark&amp;align=left&amp;font=jetbrains-mono&amp;watermark=true&amp;border=false" /><img alt="header" src="https://shieldcn.dev/header/transparent.svg?title=agent-plugin-sdk&amp;subtitle=Write+an+agent+plugin+once%2C+ship+it+to+every+harness.+Skills%2C+commands%2C+subagents%2C+hooks%2C+MCP%2C+and+shared+tools+from+one+typescript+definition.&amp;size=wide&amp;mode=light&amp;align=left&amp;font=jetbrains-mono&amp;watermark=true&amp;border=false" /></picture>
</p>

<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/group/npm/ap-sdk+github/stars/jal-co/agent-plugin-sdk+github/jal-co/agent-plugin-sdk/contributors+github/jal-co/agent-plugin-sdk/license.svg" /><img alt="badge group" src="https://shieldcn.dev/group/npm/ap-sdk+github/stars/jal-co/agent-plugin-sdk+github/jal-co/agent-plugin-sdk/contributors+github/jal-co/agent-plugin-sdk/license.svg?mode=light" /></picture>
</p>

<div align="center">

[Homepage](https://ap-sdk.dev) · [Docs](https://ap-sdk.dev/docs) · [𝕏](https://x.com/jalcowastaken)

</div>

> Originally created by Sahaj Jain ([@jnsahaj](https://github.com/jnsahaj)) and continued here with permission.

Each coding agent — Claude Code, Codex, Gemini CLI, Copilot, Cursor, Windsurf, Pi, OpenCode — has its own plugin system, file layout, and frontmatter rules. **agent-plugin-sdk** lets you define a plugin **once** in TypeScript and compiles it to the **native installable artifacts** each harness expects. No runtime, no wrapper — the output is exactly the files those harnesses load on their own.

```ts
import { definePlugin, defineSkill } from "ap-sdk";

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
pnpm add -D ap-sdk
```

[Docs](https://github.com/jal-co/agent-plugin-sdk) · [Examples](./packages/agent-plugin-sdk/examples)

## License

[MIT](./LICENSE) · Originally by [Sahaj Jain](https://github.com/jnsahaj), continued by [Justin Levine](https://github.com/jal-co).
