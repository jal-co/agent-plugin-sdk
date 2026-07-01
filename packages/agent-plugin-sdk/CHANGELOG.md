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
