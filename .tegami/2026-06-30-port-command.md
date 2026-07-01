---
packages:
  "@jalco/ap-sdk": minor
---

## `ap-sdk port` — generate a portable plugin from an existing one

New `ap-sdk port [dir]` reads an existing plugin/config in any harness's native
layout (auto-detected: Claude Code, Codex, Gemini, Copilot, Cursor, Windsurf,
OpenCode, Pi, or a generic skills/commands/agents tree) and writes a `plugin.ts`
that **loads its files** — mapping the manifest, instruction file, `**/SKILL.md`
skills, commands, agents (model + extra frontmatter), and hooks (native event
names → portable), and shipping companion directories via `readDir`. Adds
`readBody` / `readBodyFrom` helpers that load a body from its native
`frontmatter + body` file.
