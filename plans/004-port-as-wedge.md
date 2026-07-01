# Plan 004: Make `ap-sdk port` the acquisition wedge (positioning + content)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fe6fb92..HEAD -- README.md apps/docs/content/docs packages/agent-plugin-sdk/src/port.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 001 (README overhaul — this plan edits the sections 001 creates)
- **Category**: direction
- **Planned at**: commit `fe6fb92`, 2026-07-01

## Why this matters

Almost nobody adopting this SDK starts from zero — the addressable audience is
people who **already** maintain a Claude Code plugin, a `.cursor/` rules setup,
Copilot prompt files, etc., and want them on other harnesses. The SDK already
has the killer feature for them: `ap-sdk port` auto-detects an existing native
layout and generates a portable `plugin.ts` that loads their files
(`src/port.ts`, 492 lines, shipped recently — commit `efd6a3e`). But the
positioning buries it: the README leads with `definePlugin` from scratch, and
the docs have a single porting page framed as Claude-only ("Port a Claude Code
plugin") even though the detector handles nine source layouts. This plan
repositions porting as a co-equal entry path and expands its docs surface so
each "port from X" query has a landing page.

## Current state

- `packages/agent-plugin-sdk/src/port.ts` — `portPlugin(dir)` detects the
  source layout and returns `{ detected, counts, code }`. The docs page
  (`porting.mdx`) states it auto-detects: "Claude Code, Codex, Gemini, Copilot,
  Cursor, Windsurf, OpenCode, Pi, or a generic `skills/` + `commands/` +
  `agents/` tree". **Verify this list against the detection logic in
  `src/port.ts` before writing any page** — the docs pages must claim exactly
  what the detector does.
- `apps/docs/content/docs/porting.mdx` — the single existing porting page.
  Frontmatter: `title: Port a Claude Code plugin`. Structure: "The fast path:
  `ap-sdk port`" (CLI usage), "The mapping" (Claude→ap-sdk table), "Keep your
  files on disk" (`readText`/`readTextFrom`/`readDir` usage).
- `apps/docs/content/docs/meta.json` — sidebar; `porting` sits in the
  `---Guides---` section. (If plan 003 landed, there is also a `---Define---`
  section — leave it alone.)
- Root `README.md` — after plan 001, has an "Already have a plugin?" section
  showing `npx ap-sdk port`. This plan promotes that section **above** the
  from-scratch example.
- `skills/port-claude-plugin/` — an in-repo agent skill for porting exists
  (recon signal that porting is a maintained workflow).
- `apps/docs/content/docs/index.mdx` — intro page; currently pitches only the
  define-from-scratch path.
- CLI porting UX (from `src/cli.ts` `runPort`, ~line 470): prints
  `Ported <detected> → <path>` and next steps `ap-sdk check` / `ap-sdk build`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install deps | `pnpm install` | exit 0 |
| Docs build | `pnpm turbo build --filter=@jal-co/docs` | exit 0 |
| Read the detector | `sed -n '1,120p' packages/agent-plugin-sdk/src/port.ts` | source, not guesses |
| Full gate | `pnpm turbo typecheck test lint build` | all tasks pass |

## Scope

**In scope** (the only files you should modify/create):

- `apps/docs/content/docs/porting.mdx` — retitle/reframe as the harness-neutral hub
- `apps/docs/content/docs/porting/` — new per-source subpages (see Step 2; create `meta.json` inside if Fumadocs requires one for the folder)
- `apps/docs/content/docs/meta.json` — sidebar wiring for the subpages
- `apps/docs/content/docs/index.mdx` — add the "already have a plugin" entry path
- `README.md` — reorder so porting appears as a first-class entry path

**Out of scope** (do NOT touch):

- `packages/agent-plugin-sdk/src/**` — no code changes. If the detector doesn't
  support a layout you want a page for, the page doesn't get written (STOP and
  note it) — never overclaim.
- Paid/SEO tooling, analytics, ads — content only.
- The homepage app (`apps/docs/src/app/page.tsx`) — a landing-page redesign is
  bigger than this plan; note it in Maintenance if tempting.

## Git workflow

- Branch: `docs/port-wedge`
- Commit style: `docs: reposition porting as a first-class entry path`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Verify the detector's actual source-layout list

Read `packages/agent-plugin-sdk/src/port.ts` and list which source layouts
`portPlugin` actually detects and what it extracts for each (manifest,
instructions, skills, commands, agents, hooks, companion dirs). Write the list
down — it drives Steps 2–4. Cross-check with `test/port.test.ts`.

**Verify**: your list matches `porting.mdx`'s claim ("Claude Code, Codex,
Gemini, Copilot, Cursor, Windsurf, OpenCode, Pi, or a generic tree") — if it
doesn't, the *code* is the truth; adjust the pages accordingly and flag the
stale claim in `porting.mdx` as part of Step 2.

### Step 2: Reframe `porting.mdx` as the neutral hub

- Change frontmatter to `title: Port an existing plugin` with a description
  naming several sources ("Claude Code plugin, Cursor rules, Copilot prompts…").
- Keep the existing "fast path" + `readText`/`readDir` content.
- Move the Claude-specific mapping table into the Claude subpage (Step 3) and
  replace it with a short per-source table of links: source layout → subpage.
- Keep the URL `/docs/porting` (do not rename the file — it's linked from the
  CLI-adjacent docs and possibly externally).

**Verify**: `pnpm turbo build --filter=@jal-co/docs` → exit 0.

### Step 3: Write per-source subpages

Create `apps/docs/content/docs/porting/<source>.mdx` for each layout the
detector supports (per Step 1 — expected: `claude.mdx`, `codex.mdx`,
`gemini.mdx`, `copilot.mdx`, `cursor.mdx`, `windsurf.mdx`, `opencode.mdx`,
`pi.mdx`; skip any the detector doesn't truly handle). Each page is short
(~40–80 lines) and follows one fixed structure so they're cheap to maintain:

1. Frontmatter: `title: Port a <Source> plugin to every harness`, description
   naming the other seven targets (this is the SEO surface — each page matches
   the query "port <source> plugin to <other harness>").
2. What the detector looks for in that layout (from Step 1 — e.g. for Claude:
   `.claude-plugin/plugin.json`, `CLAUDE.md`, `skills/**/SKILL.md`,
   `agents/*.md`, `commands/*.md`, `hooks/hooks.json`).
3. The command: `npx ap-sdk port ./my-plugin` (+ `--dry-run`).
4. The mapping table for that source (Claude's moves here from the old
   `porting.mdx`; write the others from the Step 1 findings — **only rows you
   verified in `port.ts`**).
5. "What doesn't carry over" — anything the source has that the portable model
   drops or TODO-flags (e.g. `port.ts:474` comments `// TODO: native "<event>"
   had no portable event; defaulted` — mention that unmapped hook events are
   flagged in the generated code).
6. Next steps: `ap-sdk check` → `ap-sdk build` → link `/docs/harnesses`.

Wire the subpages into the sidebar: in `meta.json`, replace the `porting` entry
with `porting` followed by the folder pages, or use a nested `porting/meta.json`
— match how Fumadocs handles folders in this repo (check
`apps/docs/source.config.ts` and existing structure; there are currently no
nested folders, so consult Fumadocs' file-routing conventions and keep the hub
page at `/docs/porting`).

**Verify**: `pnpm turbo build --filter=@jal-co/docs` → exit 0; each new page
reachable in the sidebar (run `pnpm --filter @jal-co/docs dev` and check, or
confirm the build's route output includes `/docs/porting/claude` etc.).

### Step 4: Promote porting in the README and docs intro

- `README.md`: move the "Already have a plugin?" section (created by plan 001)
  directly under the hero code example, so the two entry paths read: "start
  from scratch" / "port what you have". Two to four lines each, links to
  `/docs/quickstart` and `/docs/porting`.
- `apps/docs/content/docs/index.mdx`: in the intro (before "## Why"), add one
  sentence + link: already have a plugin for one of these harnesses? →
  `/docs/porting`.

**Verify**: `grep -n "port" README.md | head -5` → porting appears before the
"Install" section; docs build exits 0.

## Test plan

Docs/content only — no unit tests. The load-bearing verification is Step 1
(every claim traced to `port.ts` or `test/port.test.ts`) and the MDX build.

## Done criteria

- [ ] `/docs/porting` is harness-neutral; per-source subpages exist for exactly the layouts `port.ts` detects
- [ ] Claude mapping table lives on `/docs/porting/claude`, not the hub
- [ ] README shows the port path above the fold (before Install)
- [ ] Every mapping-table row traceable to `src/port.ts` (Step 1 notes kept in the PR description)
- [ ] `pnpm turbo build --filter=@jal-co/docs` and the full gate exit 0
- [ ] No `.tegami/` changelog (docs + README only; no `packages/agent-plugin-sdk` changes)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- Plan 001 has not landed and there is no "Already have a plugin?" README
  section to promote — do 001 first or fold its Step 2 in here, but report the
  dependency violation rather than silently merging plans.
- `port.ts` detects meaningfully fewer layouts than `porting.mdx` claims —
  report the gap; writing pages for unsupported sources is overclaiming.
- Fumadocs folder routing in this repo won't allow a `porting/` subtree with
  the hub at `/docs/porting` after one reasonable attempt — report with what
  you tried.

## Maintenance notes

- When a new harness gains port-detection support in `port.ts`, add its
  subpage — the fixed page structure makes that a 30-minute task.
- Follow-up deferred out of this plan: a demo GIF/asciicast of `ap-sdk port`
  for the README and homepage; a homepage hero variant leading with porting.
- Reviewer: the risk in this plan is overclaiming — check the mapping tables
  against `port.ts`, not against the old docs.
