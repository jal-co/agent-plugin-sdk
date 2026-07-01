---
packages:
  "@jalco/ap-sdk": minor
---

## Load plugin text from files, plus more hook events

- New `readText` / `readTextFrom` helpers load instructions, skill and command
  bodies, and subagent prompts from a `src/` folder instead of inlining big
  strings — resolve paths relative to the plugin via `import.meta.url`.
- New portable hook events: `notification`, `permission-request`,
  `subagent-stop`, `pre-compact`, and `session-end`, translated to each harness's
  native names. A harness with no native form for an event now emits a structured
  warning and skips it instead of guessing.
