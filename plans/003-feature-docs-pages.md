# Plan 003: Add per-feature docs pages (skills, commands, subagents, hooks, MCP, tools, files)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fe6fb92..HEAD -- apps/docs/content/docs packages/agent-plugin-sdk/src/types.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (001 recommended first so README links have targets to
  point at, but not required)
- **Category**: docs
- **Planned at**: commit `fe6fb92`, 2026-07-01

## Why this matters

The docs site has 8 pages, all setup/guides. There is **no page** for any of the
seven definable features — skills, commands, subagents, hooks, MCP servers,
shared tools, companion files — even though the SDK's JSDoc in
`packages/agent-plugin-sdk/src/types.ts` documents each one thoroughly. Users
can't discover most of the SDK's capabilities from the site, and the site has
zero SEO surface for terms like "agent hooks", "portable MCP config", or
"cross-harness slash commands". This plan converts the existing JSDoc knowledge
into a "Define" section of the docs.

## Current state

- Docs live in `apps/docs/content/docs/*.mdx` (Fumadocs MDX). Current pages:
  `index`, `installation`, `quickstart`, `installing-plugins`, `porting`,
  `harnesses`, `authoring-a-harness`, `origins`.
- Sidebar order is `apps/docs/content/docs/meta.json`:
  ```json
  {
    "title": "Docs",
    "root": true,
    "pages": [
      "---Get started---",
      "index", "installation", "quickstart",
      "---Guides---",
      "installing-plugins", "porting", "harnesses", "authoring-a-harness",
      "---Project---",
      "origins"
    ]
  }
  ```
- Page frontmatter convention (from `quickstart.mdx`):
  ```md
  ---
  title: Quick start
  description: Define a plugin and compile it to every harness in a few minutes.
  ---
  ```
- Code blocks use plain fenced blocks with `title="plugin.ts"` meta; a
  `compact` meta flag exists (`source.config.ts` wires `remarkCodeMeta`).
  A `<SupportMatrix />` MDX component exists (used in `harnesses.mdx`) —
  generated from the SDK's `supportMatrix()` at build time.
- **The content source of truth** is `packages/agent-plugin-sdk/src/types.ts`
  (472 lines, exhaustively JSDoc'd). Key facts per feature (verify against the
  file while writing; do not invent):
  - **Skill** (`Skill`): kebab-case `name` (max 64 chars), `description` max
    1024 chars ("the tightest limit across harnesses"; description drives
    triggering — front-load trigger conditions), `instructions` body,
    `allowedTools` (Claude Code, Pi), `disableModelInvocation` (Pi),
    `license`, `metadata` (OpenCode, Pi), `frontmatter` escape hatch (merged,
    SDK fields win on clash), `resources` (extra files in the skill dir).
  - **Command** (`Command`): `$ARGUMENTS` portable everywhere; `$1, $2…`
    authored 1-based, Claude emitter rewrites to 0-based; `` !`shell` `` and
    `@file` pass through (Claude, OpenCode); `argumentHint`; `allowedTools`
    (Claude); `frontmatter` (ignored by Gemini TOML and Cursor plain md);
    `harness` overrides: `claude.model`, `opencode.model`,
    `copilot.model`/`copilot.agent`.
  - **Subagent** (`Subagent`): `prompt` maps to Claude/OpenCode body, Codex
    `developer_instructions`; `tools` (Claude); `frontmatter` (YAML harnesses;
    Codex TOML ignores); `harness` per-target models incl.
    `gemini.temperature`/`maxTurns`, `opencode.mode`
    (`primary`/`subagent`/`all`). **Pi has no subagents** — structured warning.
  - **Hook** (`Hook`): portable `HookEvent` union — `pre-tool-use`,
    `post-tool-use`, `stop`, `user-prompt-submit`, `session-start`,
    `notification`, `permission-request`, `subagent-stop`, `pre-compact`,
    `session-end`; SDK translates spellings (`pre-tool-use` → Claude
    `PreToolUse`, Copilot `preToolUse`, Gemini `BeforeTool`); `matcher`,
    `timeout`, `async` (Claude native; dropped-with-warning elsewhere),
    `HookCommand` object form with `powershell` (Copilot); per-harness
    `event`/`matcher` overrides where `matcher: undefined` explicitly clears.
    Pi/OpenCode hooks are code-only → note instead of broken artifact.
  - **MCP** (`McpServer`): `McpStdioServer` (command/args/env/cwd) and
    `McpHttpServer` (url/headers); Claude/Codex `.mcp.json`, OpenCode
    `opencode.json` `mcp` key; **Pi has no native MCP** → warning.
  - **Tools** (`ToolsModule` + `defineTool`): author one `tools.ts` module
    default-exporting `defineTool(...)[]`; the build copies it into every
    harness output and generates glue — an MCP server for Claude/Codex, native
    extension/plugin for Pi/OpenCode. Local invocation:
    `ap-sdk tools --call <name> --args '{...}'` (no harness needed). Working
    examples: `packages/agent-plugin-sdk/examples/echo-tool/` and
    `examples/planreview/` (has its own README).
  - **Companion files** (`PluginFile` / `plugin.files`): emitted verbatim into
    every build tree; referenced via plugin-root variables (e.g.
    `${CLAUDE_PLUGIN_ROOT}/hooks/notify.sh`); `executable` bit preserved.
  - **Instructions** (`plugin.instructions`): compiled to `CLAUDE.md` /
    `AGENTS.md` / `GEMINI.md`; installed as an id-keyed comment block that
    merges idempotently (`mergeMarkdownBlock` in `src/install.ts`).
- Helper loaders exist and should appear in examples where natural: `readText`,
  `readTextFrom`, `readDir` (see `porting.mdx` "Keep your files on disk"
  section for usage style).
- The repo's own AGENTS.md says docs-only changes to `apps/docs/` need **no**
  changelog.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install deps | `pnpm install` | exit 0 |
| Docs build (MDX compile) | `pnpm turbo build --filter=@jal-co/docs` | exit 0 |
| Docs dev preview | `pnpm --filter @jal-co/docs dev` | serves locally |
| Full gate | `pnpm turbo typecheck test lint build` | all tasks pass |

## Scope

**In scope** (the only files you should modify/create):

- `apps/docs/content/docs/skills.mdx` (create)
- `apps/docs/content/docs/commands.mdx` (create)
- `apps/docs/content/docs/subagents.mdx` (create)
- `apps/docs/content/docs/hooks.mdx` (create)
- `apps/docs/content/docs/mcp.mdx` (create)
- `apps/docs/content/docs/tools.mdx` (create)
- `apps/docs/content/docs/instructions-and-files.mdx` (create)
- `apps/docs/content/docs/meta.json` (add a `---Define---` section)
- `apps/docs/content/docs/index.mdx` (add links to the new pages in "Next steps")

**Out of scope** (do NOT touch):

- `packages/agent-plugin-sdk/**` — content is *derived from* the code; never
  change code to match docs. If docs and code disagree, the code wins — report
  the discrepancy instead.
- `apps/docs/src/**` — no new components needed; use existing MDX elements.
- `quickstart.mdx`, `harnesses.mdx`, `porting.mdx` — cross-link *to* them, don't
  edit them (except: no edits at all in this plan).

## Git workflow

- Branch: `docs/feature-pages`
- Commit style: `docs: add per-feature reference pages` (matches `git log`, e.g.
  `docs: porting guide + agent skill, and document unsupported-feature behavior`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the sidebar section

In `apps/docs/content/docs/meta.json`, insert a `---Define---` section between
"Get started" and "Guides":

```json
"---Define---",
"skills", "commands", "subagents", "hooks", "mcp", "tools", "instructions-and-files",
```

**Verify**: `pnpm turbo build --filter=@jal-co/docs` → exit 0 (build fails on a
meta entry with no page only after pages exist — run this verify after Step 2
if it errors on missing pages).

### Step 2: Write the seven pages

For each page, follow this structure (matching the tone of `porting.mdx` /
`harnesses.mdx` — terse, code-first, no marketing):

1. Frontmatter: `title` + one-line `description`.
2. A 2–4 sentence intro: what the feature is, what it compiles to per harness.
3. A complete, runnable `plugin.ts` example (fenced block,
   `title="plugin.ts"`) exercising the feature's main fields. Base examples on
   `packages/agent-plugin-sdk/examples/git-helper/plugin.ts` (skills/commands/
   subagents) and `examples/echo-tool/` + `examples/planreview/` (tools).
4. A field-reference section: every field from the corresponding interface in
   `src/types.ts`, one row/bullet each, **including which harnesses honor it**
   (this info is in the JSDoc — transcribe, don't invent).
5. A "Portability notes" section: what happens on harnesses that can't
   represent the feature (structured warnings, never silent drops — link to
   `/docs/harnesses` for the matrix and warning semantics).
6. Cross-links: each page links the next page in the section and `/docs/harnesses`.

Page-specific requirements:

- `skills.mdx` — cover `resources`, the 1024-char description limit and
  "front-load trigger conditions" guidance, `frontmatter` escape hatch.
- `commands.mdx` — the argument-templating table (`$ARGUMENTS` vs `$1` with the
  Claude 0-based rewrite), `harness` model overrides example.
- `subagents.mdx` — per-harness `harness` bag example (claude/codex/opencode/
  gemini/copilot), the Pi unsupported note.
- `hooks.mdx` — the full `HookEvent` table with per-harness native spellings
  (from the `HookEvent` JSDoc and `src/harnesses/hooks.ts` if needed),
  `async`, the object `HookCommand` with `powershell`, per-harness
  event/matcher override example (the plan-review Claude
  `PermissionRequest` vs Codex `Stop` example from the `Hook` JSDoc).
- `mcp.mdx` — stdio + http examples, where each harness's config lands
  (`.mcp.json`, `opencode.json`), Pi warning.
- `tools.mdx` — `defineTool` + `tools.module`, the generated-glue explanation
  (MCP server for Claude/Codex, native for Pi/OpenCode), the
  `ap-sdk tools --call` local-invocation loop.
- `instructions-and-files.mdx` — `instructions` (id-keyed idempotent merge
  block), `files` companion files with `readDir`, `SkillResource` vs
  `PluginFile` distinction, plugin-root variable usage.

**Verify** (after all seven): `pnpm turbo build --filter=@jal-co/docs` → exit 0;
`ls apps/docs/content/docs/*.mdx | wc -l` → `15`.

### Step 3: Link from the intro page

In `apps/docs/content/docs/index.mdx`, extend the "## Next steps" section with
links to the new Define pages (one line each). Don't restructure the page.

**Verify**: `grep -c "/docs/hooks\|/docs/skills\|/docs/tools" apps/docs/content/docs/index.mdx` → ≥ 3.

### Step 4: Accuracy pass

For each page, re-open the corresponding interface in
`packages/agent-plugin-sdk/src/types.ts` and confirm every claimed
field/harness-support statement matches the JSDoc. Fix any invented claims.

**Verify**: `pnpm turbo typecheck test lint build` → all tasks pass.

## Test plan

Docs-only — no unit tests. Verification is the MDX build (a broken link in
`meta.json` or invalid frontmatter fails `pnpm turbo build --filter=@jal-co/docs`)
plus the Step 4 accuracy pass.

## Done criteria

- [ ] Seven new pages exist and appear in the sidebar under a "Define" section
- [ ] `pnpm turbo build --filter=@jal-co/docs` exits 0
- [ ] Every example on the pages is complete (imports + default export), not a fragment
- [ ] Each page states per-harness support/portability behavior sourced from `types.ts` JSDoc
- [ ] `index.mdx` links the new pages
- [ ] No `.tegami/` changelog added (docs-only — repo AGENTS.md §3)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `meta.json` no longer matches the excerpt (docs restructured since planning).
- A statement you need for a page contradicts between `types.ts` JSDoc and the
  emitter code in `src/harnesses/*.ts` — report the discrepancy; do not pick one
  silently.
- You feel a new MDX component is required — the existing elements suffice;
  needing more means the plan drifted.

## Maintenance notes

- These pages duplicate knowledge that lives in `types.ts` JSDoc. When a field
  is added or its harness support changes, the matching page must be updated —
  consider (later, out of scope) generating the field tables from the types the
  way `<SupportMatrix />` is generated from `supportMatrix()`.
- Plan 009 (API reference) complements this; if it lands, cross-link each
  feature page to its generated interface reference.
- Reviewer: spot-check three random field claims against `src/types.ts`.
