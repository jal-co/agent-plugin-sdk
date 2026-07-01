---
packages:
  "@jalco/ap-sdk": minor
---

## Install companion files into local harness dirs

`ap-sdk install` now relocates a plugin's companion files (`plugin.files`) into
each harness's config root (e.g. `.claude/`, `.gemini/`), preserving each file's
subpath and executable bit — not just into the build tree. Harnesses declare the
location via a new optional `filesInstallDir(scope)` on the Harness contract.
