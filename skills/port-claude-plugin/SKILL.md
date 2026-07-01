---
name: port-claude-plugin
description: >-
  Port an existing Claude Code plugin to a portable ap-sdk definePlugin that
  compiles to every harness (Codex, Gemini, Copilot, Cursor, Windsurf, Pi,
  OpenCode). Use when the user has a .claude-plugin/ (agents/, commands/, hooks/,
  skills, CLAUDE.md, companion files) and wants it to run on other coding agents,
  or asks to "port", "convert", or "make my Claude plugin work everywhere".
---

# Port a Claude Code plugin to ap-sdk

Turn a Claude Code plugin into one `definePlugin` that loads its files from disk
and compiles to every harness. **Keep the plugin's files where they are** — the
definition points at them with `readText` / `readDir`; never inline large bodies.

## 0. Try the generator first

Most of this is mechanical, so start with the built-in command — it auto-detects
the layout and writes a `plugin.ts` that loads the files:

```bash
npx ap-sdk port ./the-plugin --dry-run   # preview
npx ap-sdk port ./the-plugin             # write ./the-plugin/plugin.ts
```

Then **review** the output: fill in any `TODO`s, tighten descriptions, and use
the mapping below to fix anything the generator couldn't infer. Fall back to the
manual steps only when porting a layout the command doesn't recognize.

## 1. Inspect the plugin

Map the tree before writing code:

- `.claude-plugin/plugin.json` → `id`, `description`, `version`, `author`,
  `homepage`, `license`; `marketplace.json` → `marketplace`.
- `CLAUDE.md` → `instructions`.
- skills (`**/SKILL.md`) → `defineSkill`.
- `agents/*.md` → `defineSubagent` (read the YAML frontmatter: `name`,
  `description`, `model`, `tools`; anything else → `frontmatter`).
- `commands/*.md` → `defineCommand`.
- `hooks/hooks.json` → `defineHook` per entry; the referenced `*.sh`/`*.py`
  scripts → companion `files`.
- Any directory the instructions reference (`doctrine/`, `docs/`, `templates/`)
  → companion `files`.

## 2. Generate `plugin.ts`

```ts
import {
  definePlugin, defineSkill, defineSubagent, defineCommand, defineHook,
  readTextFrom, readDir,
} from "@jalco/ap-sdk";

const read = readTextFrom(import.meta.url);

export default definePlugin({
  id: "<from plugin.json name>",
  description: "<from plugin.json>",
  version: "<from plugin.json>",
  author: { name: "<from plugin.json>" },
  instructions: read("./CLAUDE.md"),
  skills: [/* defineSkill({ name, description, instructions: read("./skills/<n>/SKILL.md") }) */],
  subagents: [/* defineSubagent({ name, description, prompt: read("./agents/<n>.md"), tools, harness: { claude: { model } }, frontmatter: { /* effort, stage, … */ } }) */],
  commands: [/* defineCommand({ name, description, body: read("./commands/<n>.md") }) */],
  hooks: [/* defineHook({ event, matcher?, command, timeout? }) */],
  files: [
    ...readDir("./hooks", import.meta.url, "hooks"),
    // ...readDir("./doctrine", import.meta.url, "doctrine"),
  ],
});
```

## Rules

- **Load, don't inline.** Every body comes from `read("./…")`; ship folders with
  `readDir(dir, import.meta.url, prefix)` (it preserves the executable bit for
  scripts).
- **Frontmatter the SDK doesn't model goes in `frontmatter`** on the skill or
  subagent (e.g. an agent's `effort`, a nested `stage:` block). Known fields
  always win, so passthrough only adds keys.
- **Hook events**: use the portable names — `pre-tool-use`, `post-tool-use`,
  `stop`, `user-prompt-submit`, `session-start`, `notification`,
  `permission-request`, `subagent-stop`, `pre-compact`, `session-end`. When two
  harnesses wire the same intent to different native events, set
  `harness: { <id>: { event, matcher } }`.
- **Companion scripts** referenced by hooks keep their `${CLAUDE_PLUGIN_ROOT}/…`
  paths — ship them via `files` so they land in the build tree.
- **Subagent/command models** live under `harness.<id>.model`, not a top-level
  field, because model ids differ per harness.

## 3. Verify

```bash
npx ap-sdk check        # validate the definition (reports every problem at once)
npx ap-sdk build        # emit every harness tree under .aps-out/
```

Read the build **warnings**: they name anything a non-Claude harness couldn't
represent (dropped, never broken). Bridge the ones that matter with a `harness`
override; the rest degrade cleanly. Then `npx ap-sdk install -t claude` to try it
locally.
