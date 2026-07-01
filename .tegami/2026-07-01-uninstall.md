---
packages:
  "@jalco/ap-sdk": minor
---

## Add `ap-sdk uninstall`

`install` now records what it wrote to an install manifest
(`.ap-sdk/install-manifest.json`), and `ap-sdk uninstall <plugin-id>` cleanly
reverses it — deleting the plugin's files and removing only its entries from
merged configs (instruction blocks, MCP servers, hooks).
