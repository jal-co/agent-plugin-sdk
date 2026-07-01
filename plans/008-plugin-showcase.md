# Plan 008: Add a plugin showcase page to the docs site

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fe6fb92..HEAD -- apps/docs/content/docs packages/agent-plugin-sdk/examples`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (007's template repo, once real, feeds this page; not required)
- **Category**: direction
- **Planned at**: commit `fe6fb92`, 2026-07-01

## Why this matters

`ap-sdk install owner/repo` lets anyone install a plugin from GitHub
(`src/github.ts`), but there is nowhere to *find* plugins — the discovery half
of the loop is missing. Authors get no distribution benefit from building on
ap-sdk, and consumers see no ecosystem. A curated showcase page is the cheapest
closure: it starts with the repo's own three examples (honest at this stage)
and gives every future community plugin a reason to send a PR adding itself —
each entry is also a working `ap-sdk install` command a visitor can copy.

## Current state

- Docs pages live in `apps/docs/content/docs/*.mdx`; sidebar in
  `apps/docs/content/docs/meta.json`:
  ```json
  "pages": [
    "---Get started---", "index", "installation", "quickstart",
    "---Guides---", "installing-plugins", "porting", "harnesses", "authoring-a-harness",
    "---Project---", "origins"
  ]
  ```
  (Plans 003/004 may have added sections — insert without disturbing them.)
- Page conventions: YAML frontmatter `title`/`description`; terse prose;
  fenced code blocks. See `installing-plugins.mdx` for install-command style.
- Install-from-GitHub syntax (from `src/cli.ts` HELP and `src/github.ts`):
  `ap-sdk install owner/repo`, `github:owner/repo#ref`, github.com URLs,
  `--path <dir>` for plugins in a subdirectory, `--ref`.
- Seed entries — the three in-repo examples
  (`packages/agent-plugin-sdk/examples/`):
  - `git-helper` — skill with bundled resources + commands (+ subagent; verify
    by reading `examples/git-helper/plugin.ts` fully before describing it).
  - `echo-tool` — minimal shared-tools example (`plugin.ts` + `tools.ts`).
  - `planreview` — tools + hooks example with its own README (read
    `examples/planreview/README.md` for its own description of itself).
  Each is installable today:
  `ap-sdk install jal-co/agent-plugin-sdk --path packages/agent-plugin-sdk/examples/<name>`.
- Contribution conventions: `CONTRIBUTING.md` exists at the repo root — the
  showcase's "add your plugin" instructions must not contradict it.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install deps | `pnpm install` | exit 0 |
| Docs build | `pnpm turbo build --filter=@jal-co/docs` | exit 0 |
| Verify an entry installs | `cd packages/agent-plugin-sdk && pnpm cli check https://github.com/jal-co/agent-plugin-sdk --path packages/agent-plugin-sdk/examples/git-helper` | compatibility report |
| Full gate | `pnpm turbo typecheck test lint build` | all tasks pass |

## Scope

**In scope** (the only files you should modify/create):

- `apps/docs/content/docs/showcase.mdx` (create)
- `apps/docs/content/docs/meta.json` (add `showcase`)
- `apps/docs/content/docs/installing-plugins.mdx` (one cross-link to the showcase)

**Out of scope** (do NOT touch):

- A database/registry/API — this is a hand-curated MDX page by design.
- `apps/docs/src/**` — no new components; a markdown table/cards from existing
  elements is enough.
- `packages/agent-plugin-sdk/**`.
- Automated PR validation for future entries — noted in Maintenance, deferred.

## Git workflow

- Branch: `docs/showcase`
- Commit style: `docs: add plugin showcase page`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Verify the seed entries

Read each example's `plugin.ts` (and `planreview/README.md`) and run the
remote-`check` command from "Commands you will need" for at least `git-helper`.
Write each entry's one-line description from what the plugin actually contains.

**Verify**: remote check prints `is a compatible ap-sdk plugin` for git-helper.

### Step 2: Write `showcase.mdx`

Structure:

1. Frontmatter: `title: Showcase`, description "Plugins built with ap-sdk —
   install any of them with one command."
2. Intro (2 sentences) + the general install pattern:
   ```bash
   npx ap-sdk install owner/repo
   ```
3. An entry per plugin — name, one-line description, feature tags (skills /
   commands / tools / hooks / subagents — only what Step 1 verified), and its
   exact install command with `--path` where needed.
4. "Add your plugin" section: criteria (public repo, passes
   `ap-sdk check owner/repo`, has a README) and the process — open a PR editing
   this page (link the GitHub edit URL for the file, matching how the docs site
   exposes last-edited/edit links if it does — check `apps/docs/src/components/`
   for an edit-link component before hand-rolling a URL).

**Verify**: `pnpm turbo build --filter=@jal-co/docs` → exit 0.

### Step 3: Wire navigation

- `meta.json`: add `showcase` — under the `---Project---` section (or a
  `---Ecosystem---` section if that reads better with the sections present at
  execution time).
- `installing-plugins.mdx`: add one line linking the showcase ("looking for
  plugins to install? → /docs/showcase").

**Verify**: docs build exits 0; `grep -n "showcase" apps/docs/content/docs/meta.json apps/docs/content/docs/installing-plugins.mdx` → both match.

## Test plan

Docs-only — verification is the MDX build plus the Step 1 remote check
transcript (include it in the PR description).

## Done criteria

- [ ] `/docs/showcase` exists with ≥ 3 verified entries, each with a copyable install command
- [ ] Every feature tag on an entry verified against its `plugin.ts`
- [ ] "Add your plugin" section with criteria + PR process
- [ ] Sidebar + cross-link wired
- [ ] `pnpm turbo build --filter=@jal-co/docs` and full gate exit 0
- [ ] No `.tegami/` changelog (docs-only)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The remote `check` of an example fails — the install commands you'd publish
  would be broken; that's a bug to report, not to paper over.
- You're tempted to list third-party plugins you can't verify — seed entries
  only unless you can run `check` against them.

## Maintenance notes

- Each future entry PR should be gated on `ap-sdk check <their-repo>` passing —
  when entries start arriving, automate that as a docs-CI step (deferred).
- When plan 007's template repo exists, list it here and link "Add your plugin"
  to it.
- If the list outgrows one page (> ~30 entries), that's the trigger to revisit
  a real registry — not before.
