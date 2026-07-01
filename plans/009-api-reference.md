# Plan 009: Generate an API reference section from the SDK's TypeScript API (spike + wire-up)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fe6fb92..HEAD -- apps/docs packages/agent-plugin-sdk/src/index.ts packages/agent-plugin-sdk/src/types.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED — depends on tooling fit with the docs stack; has an explicit bail-out
- **Depends on**: 003 (feature pages) — do the hand-written guides first; this
  complements, not replaces, them
- **Category**: docs / direction
- **Planned at**: commit `fe6fb92`, 2026-07-01

## Why this matters

The SDK's JSDoc (`src/types.ts`, 472 lines; `src/define.ts`; `src/harness.ts`;
the runtime adapters) is publication-quality — field-level semantics,
per-harness support notes, examples — but it's only visible to editor users.
The docs site already proves the "generated from code, can't drift" pattern
with `<SupportMatrix />` (rendered from the SDK's own `supportMatrix()` at
build time). An API reference section generated from the public entrypoints
extends that pattern to the whole API for near-zero marginal authoring cost,
and gives every exported symbol a linkable URL.

## Current state

- Public API surface (what the reference must cover), from
  `packages/agent-plugin-sdk/package.json` `exports`:
  - `.` → `dist/index.js` — main entry; see `src/index.ts` (72 lines) for the
    export list (`definePlugin`, `defineSkill`, `defineCommand`,
    `defineSubagent`, `defineHook`, `defineTool`, `build`, `installSkills`,
    read helpers, types — read the file for the exact list).
  - `./runtime` → `src/runtime/index.ts` — runtime adapters.
  - `./harness` → `src/harness.ts` — harness authoring toolkit.
- Docs stack: Next.js + **Fumadocs** (`fumadocs-mdx` — see
  `apps/docs/source.config.ts`; content collections from `content/docs`).
  Custom rendering: `rehypeCodeOptions: false` (fenced code rendered by a
  custom CodeBlock with its own shiki pass) and a `remarkCodeMeta` plugin —
  **generated MDX must not fight these**.
- Fumadocs has first-party TypeScript-docs tooling ("Fumadocs TypeScript" /
  `fumadocs-typescript`, with an `AutoTypeTable` component) — evaluate it
  *first* since it's native to the stack; TypeDoc
  (`typedoc` + `typedoc-plugin-markdown`) is the fallback.
- The docs app is private (`@jal-co/docs`) — no changelog needed for docs-only
  changes (repo AGENTS.md §3).
- Sidebar: `apps/docs/content/docs/meta.json` (sections; plans 003/004/008 may
  have altered it — read before editing).
- The monorepo builds docs with `pnpm turbo build --filter=@jal-co/docs`;
  turbo's `build` task `dependsOn: ["^build"]`, so the SDK's `dist/` exists
  when docs build (relevant if the tool consumes built `.d.ts`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install deps | `pnpm install` | exit 0 |
| Docs build | `pnpm turbo build --filter=@jal-co/docs` | exit 0 |
| SDK build (for .d.ts) | `pnpm turbo build --filter=@jalco/ap-sdk` | exit 0 |
| Full gate | `pnpm turbo typecheck test lint build` | all tasks pass |

## Scope

**In scope** (the only files you should modify/create):

- `apps/docs/**` — tool config, generated-content wiring, sidebar, an
  `api/index.mdx` landing page (exact files depend on the Step 1 choice; keep a
  list in the PR description)
- `apps/docs/package.json` — the generator devDependency + a script
- `plans/009-artifacts/decision.md` (create — records the tool evaluation)

**Out of scope** (do NOT touch):

- `packages/agent-plugin-sdk/src/**` — **exception**: pure JSDoc-comment fixes
  (typos, broken `{@link}` targets) surfaced by the generator are allowed;
  no code or type changes whatsoever.
- Restructuring plan 003's hand-written feature pages.
- Publishing config, `.tegami/` (docs-only; JSDoc-comment-only SDK edits don't
  change emitted behavior — if you're unsure whether an edit is user-facing,
  STOP instead).

## Git workflow

- Branch: `docs/api-reference`
- Commit style: `docs: generate API reference from SDK types`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Evaluate tooling (timebox: ~1 hour of effort each, max two attempts)

Try in order; stop at the first that meets the bar:

1. **Fumadocs' native TypeScript integration** (`fumadocs-typescript` /
   `AutoTypeTable`) — read its current docs at https://fumadocs.dev (fetch the
   TypeScript-integration page), install in `apps/docs`, and render the
   `Plugin` + `Skill` interfaces on a scratch page.
2. **TypeDoc → markdown** (`typedoc` + `typedoc-plugin-markdown`) emitting into
   a gitignored `content/docs/api/` subtree wired into the collection.

The bar (all must hold):
- JSDoc descriptions render (they carry the per-harness semantics — a
  signatures-only reference fails the plan's purpose);
- output coexists with the custom CodeBlock/`rehypeCodeOptions: false` setup
  without double-highlighting or broken fences;
- generation is reproducible via a package script (`pnpm --filter @jal-co/docs
  generate:api` or build-time), not a manual step.

Record the evaluation in `plans/009-artifacts/decision.md`: what was tried,
what met/failed the bar, the choice. **If neither fits within the timebox,
STOP** — write the decision doc with findings and mark this plan BLOCKED in the
index; partial tooling hacks age terribly.

**Verify**: `decision.md` exists and names a choice (or BLOCKED).

### Step 2: Wire the chosen tool

Cover the three entrypoints (`@jalco/ap-sdk`, `/runtime`, `/harness`) as three
reference groups. Add:

- the generator config + package script;
- an `---API---` (or `---Reference---`) sidebar section in `meta.json` with an
  `api/index.mdx` landing page listing the three entrypoints and linking the
  hand-written feature guides (`/docs/skills` etc., if plan 003 landed);
- if generation is a build step, wire it so `pnpm turbo build --filter=@jal-co/docs`
  runs it (turbo task input/output config or a `prebuild` script — match how
  the app already runs codegen if it does; check `apps/docs/package.json`
  scripts first).

**Verify**: `pnpm turbo build --filter=@jal-co/docs` → exit 0 from a clean
checkout state (delete any generated dir first to prove regeneration works).

### Step 3: Quality pass on the rendered output

Open the generated pages for `definePlugin`, `Skill`, `Hook`, and
`defineHarness` (dev server or build output). Fix at the source:

- broken `{@link X}` references in JSDoc → fix the JSDoc (allowed exception);
- noisy internal symbols leaking into the reference → tighten the generator's
  entry-point/visibility config, not the source exports.

**Verify**: the four spot-checked pages show field descriptions (not bare
signatures); no page renders raw `{@link ...}` text
(`grep -rn "{@link" <generated output dir>` → 0 matches, adjust path to the
chosen tool's output).

### Step 4: Gate

**Verify**: `pnpm turbo typecheck test lint build` → all tasks pass (includes
the SDK — proves JSDoc-only edits broke nothing).

## Test plan

No unit tests — the docs build *is* the test (generation runs in it). The
Step 3 spot-check list (4 symbols) is the acceptance review; record it in the
PR description.

## Done criteria

- [ ] `plans/009-artifacts/decision.md` records the tool evaluation and choice
- [ ] API reference section in the sidebar covering all three entrypoints
- [ ] JSDoc descriptions visible on rendered pages (4-symbol spot check)
- [ ] Regeneration reproducible via a script/build step from clean state
- [ ] Only JSDoc comments (if anything) changed under `packages/agent-plugin-sdk/src`
- [ ] `pnpm turbo typecheck test lint build` exits 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- Neither tool meets the Step 1 bar within the timebox (mark BLOCKED with the
  decision doc — this is an acceptable outcome).
- The generator requires changing `src/index.ts` exports or `package.json`
  `exports` to produce sane output — API surface changes are out of scope.
- Generated output requires disabling the custom CodeBlock pipeline.

## Maintenance notes

- Once this lands, plan 003's field tables partially duplicate the reference —
  a future pass can slim the guides to examples + portability notes and link
  field details to the reference.
- New exports are picked up automatically; reviewers of SDK PRs should still
  glance at the rendered reference for JSDoc quality.
- If the docs site adds versioned docs later, the generation step must pin to
  the matching SDK version.
