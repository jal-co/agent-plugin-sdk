---
packages:
  "@jalco/ap-sdk": minor
---

## Ship companion files with a plugin

`Plugin.files` bundles companion files at the plugin root — hook scripts,
reference docs, JSON read by the plugin's instructions — emitted into every
harness build tree at their path. The new `readDir` helper loads a whole `src/`
folder (recursively, preserving the executable bit), so hooks can reference their
scripts via the harness's plugin-root variable (e.g. `${CLAUDE_PLUGIN_ROOT}/…`).
