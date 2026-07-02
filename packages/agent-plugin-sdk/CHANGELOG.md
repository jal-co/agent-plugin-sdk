## @jalco/ap-sdk@0.4.0

### Per-hook `async` flag and command frontmatter passthrough

- `Hook.async` — mark a hook fire-and-forget. Emitted natively where the harness
  models it (Claude Code `"async": true`); on harnesses that don't, it's dropped
  with an `unsupported-option` warning and the hook runs synchronously within its
  timeout. `ap-sdk port` round-trips it from an existing `hooks.json`.
- `Command.frontmatter` — the same escape hatch already on `Skill` and
  `Subagent`, now on `Command`. Extra fields merge into the generated command
  frontmatter on YAML-frontmatter harnesses (Claude, Codex, OpenCode, Pi,
  Copilot, Windsurf); known fields win a clash. Gemini (TOML) and Cursor (plain
  markdown) ignore it. `ap-sdk port` captures unknown command fields into it.

### Add `ap-sdk dev`

Watch mode for plugin authors: `ap-sdk dev` rebuilds on every change to the
plugin and its referenced files, and `--install` drops the result straight
into your local harness dirs. Errors keep the watcher alive.

### Add `ap-sdk init`

Scaffold a new plugin project with one command. `ap-sdk init my-plugin` writes
a working `plugin.ts` (a skill, a command, and instructions) that passes
`ap-sdk check` as-is, plus a `.gitignore` entry for `.aps-out/`.

### Install plugins from npm

`ap-sdk install npm:<package>` (and `check`/`build` with the same spec)
fetches a published package from the npm registry, verifies it's a
compatible plugin, and installs it — with `npm:<package>@<version>` for
pinning. Packages can point at a non-root plugin file via an
`ap-sdk.plugin` field in package.json.

### Add a package README

The npm page for `@jalco/ap-sdk` now has a readme covering the full feature
surface (skills, commands, subagents, hooks, MCP, shared tools) and the
`ap-sdk port` migration path.

### Add `ap-sdk uninstall`

`install` now records what it wrote to an install manifest
(`.ap-sdk/install-manifest.json`), and `ap-sdk uninstall <plugin-id>` cleanly
reverses it — deleting the plugin's files and removing only its entries from
merged configs (instruction blocks, MCP servers, hooks).

## @jalco/ap-sdk@0.3.0

### Ship companion files with a plugin

`Plugin.files` bundles companion files at the plugin root — hook scripts,
reference docs, JSON read by the plugin's instructions — emitted into every
harness build tree at their path. The new `readDir` helper loads a whole `src/`
folder (recursively, preserving the executable bit), so hooks can reference their
scripts via the harness's plugin-root variable (e.g. `${CLAUDE_PLUGIN_ROOT}/…`).

### Load plugin text from files, plus more hook events

- New `readText` / `readTextFrom` helpers load instructions, skill and command
  bodies, and subagent prompts from a `src/` folder instead of inlining big
  strings — resolve paths relative to the plugin via `import.meta.url`.
- New portable hook events: `notification`, `permission-request`,
  `subagent-stop`, `pre-compact`, and `session-end`, translated to each harness's
  native names. A harness with no native form for an event now emits a structured
  warning and skips it instead of guessing.

### Frontmatter passthrough on skills and subagents

`defineSkill` and `defineSubagent` accept a `frontmatter` escape hatch for extra
native frontmatter fields the SDK doesn't model (e.g. `effort`, a nested
`stage:` block). It's merged into every skill's `SKILL.md` and into subagent YAML
frontmatter (Claude, OpenCode, Copilot, Gemini); the SDK's own fields win on a
key clash.

### Install companion files into local harness dirs

`ap-sdk install` now relocates a plugin's companion files (`plugin.files`) into
each harness's config root (e.g. `.claude/`, `.gemini/`), preserving each file's
subpath and executable bit — not just into the build tree. Harnesses declare the
location via a new optional `filesInstallDir(scope)` on the Harness contract.

### `ap-sdk port` — generate a portable plugin from an existing one

New `ap-sdk port [dir]` reads an existing plugin/config in any harness's native
layout (auto-detected: Claude Code, Codex, Gemini, Copilot, Cursor, Windsurf,
OpenCode, Pi, or a generic skills/commands/agents tree) and writes a `plugin.ts`
that **loads its files** — mapping the manifest, instruction file, `**/SKILL.md`
skills, commands, agents (model + extra frontmatter), and hooks (native event
names → portable), and shipping companion directories via `readDir`. Adds
`readBody` / `readBodyFrom` helpers that load a body from its native
`frontmatter + body` file.

## @jalco/ap-sdk@0.2.0

### Install plugins straight from GitHub

`ap-sdk install` and `ap-sdk check` now accept a GitHub source — `owner/repo`,
`github:owner/repo`, or a github.com URL, with an optional `#ref` for a branch,
tag, or commit. The repository is downloaded, **validated for compatibility with
the ap-sdk plugin format**, and only installed if it default-exports a valid
`definePlugin(...)` result; otherwise the install is aborted with the reason.

Pass `--path <dir>` for a plugin in a subdirectory, and set `GITHUB_TOKEN` for
private repos or a higher API rate limit.
