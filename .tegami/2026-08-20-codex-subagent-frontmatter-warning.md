---
packages:
  "@jalco/ap-sdk": patch
---

### Warn when Codex drops a subagent's `frontmatter` passthrough

Codex agents are TOML with fixed fields, so `Subagent.frontmatter` has no native form there and is dropped. That drop is now reported as an `unsupported-option` `BuildWarning`, alongside the `tools` warning already emitted for the same agent. It used to be silent, so a caller reading `warnings[]` could not tell that the escape hatch had been discarded.
