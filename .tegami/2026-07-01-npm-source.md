---
packages:
  "@jalco/ap-sdk": minor
---

## Install plugins from npm

`ap-sdk install npm:<package>` (and `check`/`build` with the same spec)
fetches a published package from the npm registry, verifies it's a
compatible plugin, and installs it — with `npm:<package>@<version>` for
pinning. Packages can point at a non-root plugin file via an
`ap-sdk.plugin` field in package.json.
