---
packages:
  "@jalco/ap-sdk": minor
---

## Frontmatter passthrough on skills and subagents

`defineSkill` and `defineSubagent` accept a `frontmatter` escape hatch for extra
native frontmatter fields the SDK doesn't model (e.g. `effort`, a nested
`stage:` block). It's merged into every skill's `SKILL.md` and into subagent YAML
frontmatter (Claude, OpenCode, Copilot, Gemini); the SDK's own fields win on a
key clash.
