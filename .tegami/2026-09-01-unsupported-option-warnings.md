---
packages:
  "@jalco/ap-sdk": patch
---

### Warn for silently dropped skill, command, and hook options

Emitters that cannot represent a declared optional field now record an `unsupported-option` warning instead of dropping the field silently, the same contract the Codex subagent warnings already followed. This covers `allowedTools`, `disableModelInvocation`, `license`, and `metadata` on skills, `allowedTools`, `argumentHint`, and passthrough `frontmatter` on commands, and the `powershell` hook command variant on harnesses with a single command slot. Output files are unchanged: the build still degrades, and `warnings[]` now tells the caller what was lost.
