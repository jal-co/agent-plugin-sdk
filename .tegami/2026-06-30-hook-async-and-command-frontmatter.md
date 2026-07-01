---
packages:
  "@jalco/ap-sdk": minor
---

## Per-hook `async` flag and command frontmatter passthrough

- `Hook.async` — mark a hook fire-and-forget. Emitted natively where the harness
  models it (Claude Code `"async": true`); on harnesses that don't, it's dropped
  with an `unsupported-option` warning and the hook runs synchronously within its
  timeout. `ap-sdk port` round-trips it from an existing `hooks.json`.
- `Command.frontmatter` — the same escape hatch already on `Skill` and
  `Subagent`, now on `Command`. Extra fields merge into the generated command
  frontmatter on YAML-frontmatter harnesses (Claude, Codex, OpenCode, Pi,
  Copilot, Windsurf); known fields win a clash. Gemini (TOML) and Cursor (plain
  markdown) ignore it. `ap-sdk port` captures unknown command fields into it.
