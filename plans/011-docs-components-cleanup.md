# Plan 011: Docs content components & cleanup — Callout/Tabs, mobile TOC + AI copy, dead navbar variant

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fe6fb92..HEAD -- apps/docs/src`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none — but **execute before plan 003** (the seven feature
  pages should use Callout/Tabs instead of faking them with blockquotes)
- **Category**: dx / docs / tech-debt
- **Planned at**: commit `fe6fb92`, 2026-07-01

## Why this matters

Three self-contained gaps in the docs app, bundled because they share files:
(1) the MDX component map has **no Callout or Tabs**, so content pages can't
express warnings ("Pi has no MCP — the build emits a structured warning") or
alternative paths without abusing blockquotes — and plan 003 is about to write
seven pages that need exactly those; (2) the right rail containing the TOC
**and the AI copy button** is `hidden xl:block`, so tablet and mobile readers
lose both "On this page" and the site's most differentiating feature (copy page
for AI / open in Claude); (3) the navbar's scroll-driven "floating" variant is
dead code — `/` redirects to `/docs` (a recorded decision) and the only usage
is `variant="docs"` — carrying ~90 lines and the `motion` dependency for an
unrendered path.

## Current state

- **MDX component map**: `src/components/mdx.tsx` — `getMDXComponents()` wires:
  `pre` → CodeBlock/CodeLine routing, `NpmCommand`/`CodeBlockCommand`,
  `SupportMatrix`, and `a` → Next `Link`. Nothing else. All code components
  opt out of prose via `not-prose` (see the `CodeBlock` wrapper comment) — new
  block components must do the same.
- **Component style conventions**: hand-rolled "jalco-ui" components with a
  header comment block (see `src/components/code-block-command.tsx:1-21`),
  `cva` for variants (`ai-copy-button.tsx`), `cn()` from `src/lib/utils`,
  Tailwind v4, `lucide-react@1.21.0` for icons, `radix-ui` monolithic package
  for primitives. `fumadocs-ui` is installed but its components are
  deliberately unused — keep it that way.
- **Persistent tab selection precedent**: `code-block-command.tsx` persists the
  chosen package manager to `localStorage` under `jalco-ui-pkg-manager` —
  reuse this pattern for generic Tabs with a `storageKey` prop.
- **Right rail**: `src/app/docs/[[...slug]]/page.tsx` — layout grid is
  `grid-cols-1 … xl:grid-cols-[minmax(0,1fr)_14rem]`; the second column is
  `<div className="hidden xl:block">` wrapping `DocsToc`, `AiCopyButton`
  (`value={pageText}`), and the last-edited line. Below `xl` none of it
  renders. The mobile sidebar disclosure (`DocsMobileNav` in
  `src/app/docs/layout.tsx`) covers site nav only, not page TOC.
- **`DocsToc`**: `src/components/docs-toc.tsx` — client component on
  `fumadocs-core/toc` (`AnchorProvider`/`ScrollProvider`/`TOCItem`) with
  scrollspy; reusable as-is inside any container.
- **Dead navbar variant**: `src/components/site-navbar.tsx` — two variants:
  `"docs"` (flush header) and `"floating"` (default; scroll storyboard with
  `motion/react` — `useScroll`, `useMotionValueEvent`, `motion.nav`, the
  `SCROLL`/`SHELL` constant blocks). Usage: `rg "SiteNavbar" apps/docs/src`
  → only `src/app/docs/layout.tsx` with `variant="docs"`. `src/app/page.tsx`
  redirects `/` → `/docs` with the comment "This is a developer tool, not a
  SaaS — there's no marketing landing. The docs are the site." Check whether
  anything else imports `motion` before removing the dep:
  `rg -l "from \"motion" apps/docs/src`.
- Docs app is private — **no `.tegami/` changelog** for this work.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install deps | `pnpm install` | exit 0 |
| Dev server | `pnpm --filter @jal-co/docs dev` | serves on localhost |
| Typecheck | `pnpm turbo typecheck --filter=@jal-co/docs` | exit 0 |
| Lint | `pnpm --filter @jal-co/docs lint` | biome exit 0 |
| Full gate | `pnpm turbo typecheck test lint build` | all tasks pass |

## Scope

**In scope** (the only files you should modify/create):

- `apps/docs/src/components/callout.tsx` (create)
- `apps/docs/src/components/tabs.tsx` (create)
- `apps/docs/src/components/mdx.tsx` (register Callout + Tabs)
- `apps/docs/src/app/docs/[[...slug]]/page.tsx` (mobile TOC/actions placement)
- `apps/docs/src/components/docs-toc.tsx` (only if a collapsible variant needs a prop)
- `apps/docs/src/components/site-navbar.tsx` (remove the floating variant)
- `apps/docs/package.json` (remove `motion` only if Step 4's usage check comes back clean)

**Out of scope** (do NOT touch):

- Search/pagination/edit-link — plan 010's territory (same page file; if 010
  landed first, edit around its additions and re-verify its features render).
- Rewriting existing content pages to use Callout/Tabs — plan 003 authors with
  them; existing pages migrate opportunistically later.
- The `/` redirect itself — recorded decision; do not build a landing page.
- Any `fumadocs-ui` component import.

## Git workflow

- Branch: `feat/docs-content-components`
- Commit style: `feat(docs): callout + tabs MDX components, mobile toc, drop dead navbar variant` (or split into three commits, one per step-group)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Callout component

Create `src/components/callout.tsx` in jalco-ui style (header comment, `cva`):

- Variants: `note` (default), `tip`, `warning`, `danger` — icon
  (lucide: `Info`, `Lightbulb`, `TriangleAlert`, `OctagonAlert`), left accent
  border, muted tinted background per variant, optional `title` prop, children
  as body.
- Server-safe (no client hooks). Must carry `not-prose` handling like the code
  components: register it in `mdx.tsx` wrapped with `cn("not-prose my-6", …)`
  the same way `CodeBlock` is, while keeping readable text styles inside.
- Register in `getMDXComponents()` as `Callout`.

**Verify**: add `<Callout variant="warning" title="Pi">Pi has no native
MCP.</Callout>` temporarily to any page in dev, confirm rendering in light +
dark, then remove it. `pnpm turbo typecheck --filter=@jal-co/docs` → exit 0.

### Step 2: Tabs component

Create `src/components/tabs.tsx` (client component):

- API: `<Tabs items={["Claude Code", "Codex"]} storageKey?>` with `<Tab>`
  children (index-matched), or an equivalent compound API — pick the simplest
  shape that MDX authors can write without imports (registered globally).
- Behavior: Radix `Tabs` primitive from the monolithic `radix-ui` package
  (same import style as `DropdownMenu` in `ai-copy-button.tsx`); when
  `storageKey` is set, persist selection to `localStorage` mirroring the
  `code-block-command.tsx` pattern (including the storage-event sync if
  present there — read the file and match).
- Style: underline-style tab list consistent with `code-block-command`'s tab
  strip; content area unstyle-neutral so code blocks inside render normally.
- Register `Tabs` + `Tab` in `getMDXComponents()`.

**Verify**: temporary MDX snippet with two tabs each containing a fenced code
block renders and switches in dev (then remove); typecheck exits 0.

### Step 3: Mobile TOC + page actions

In `[[...slug]]/page.tsx`:

- Keep the `xl` right rail exactly as is.
- Add, above the prose column and only below `xl` (`xl:hidden`), a compact
  actions row: `AiCopyButton` (same `value={pageText}` props) and — when
  `toc.length > 0` — a collapsible "On this page" disclosure reusing `DocsToc`
  inside it. Model the disclosure markup/animation on `DocsMobileNav`'s
  grid-rows pattern in `docs-sidebar.tsx` (chevron rotate, `grid-rows-[0fr→1fr]`).
  Implement the disclosure as a small client wrapper (either inline in a new
  component file — allowed within scope as part of `docs-toc.tsx` changes — or
  as a `MobileToc` export in `docs-toc.tsx`).

**Verify**: dev server at a narrow viewport — quickstart shows the actions row
+ working TOC disclosure whose links scroll to headings; at `xl` the row is
gone and the rail unchanged.

### Step 4: Remove the dead floating navbar variant

1. `rg -l "from \"motion" apps/docs/src` — confirm `site-navbar.tsx` is the
   only importer. If anything else imports `motion`, keep the dependency and
   only do the component cleanup.
2. In `site-navbar.tsx`: delete the `floating` branch — the scroll storyboard
   comment block, `SCROLL`/`SHELL` constants, `useScroll`/
   `useMotionValueEvent`/`motion.nav` usage, and the `variant` prop entirely;
   `SiteNavbar` becomes the flush docs header unconditionally. Update the one
   call site (`docs/layout.tsx`) to drop `variant="docs"`.
3. If step 1 confirmed sole usage: remove `motion` from
   `apps/docs/package.json` and run `pnpm install` (lockfile update is
   expected and in scope).

**Verify**: `rg -n "floating|motion" apps/docs/src/components/site-navbar.tsx`
→ 0 matches; docs header renders unchanged in dev;
`pnpm turbo build --filter=@jal-co/docs` → exit 0.

### Step 5: Gate

**Verify**: `pnpm turbo typecheck test lint build` → all tasks pass.

## Test plan

No test runner in the docs app — verification is typecheck + biome + the
scripted dev-server checks in Steps 1–4 (record results in the PR description).
The temporary MDX snippets in Steps 1–2 must be removed before commit
(`git status` shows no content changes).

## Done criteria

- [ ] `Callout` (4 variants) and `Tabs`/`Tab` registered in `getMDXComponents()` and usable from MDX without imports
- [ ] Below `xl`: AI copy button + collapsible TOC available on docs pages; `xl` rail unchanged
- [ ] `SiteNavbar` has a single variant; scroll-storyboard code gone
- [ ] `motion` removed from `apps/docs/package.json` **iff** nothing else imports it (state which in the PR)
- [ ] No `fumadocs-ui` component imports (`rg "from \"fumadocs-ui" apps/docs/src` → 0)
- [ ] No stray demo snippets in `content/docs` (`git status` clean outside scope)
- [ ] `pnpm turbo typecheck test lint build` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `radix-ui`'s monolithic package doesn't export `Tabs` — report before adding
  a scoped `@radix-ui/react-tabs` dep.
- Plan 010 landed and `[[...slug]]/page.tsx` diverges from the excerpt beyond
  its documented additions (pagination footer, edit link) — reconcile by
  reading 010's diff first; on conflict, report.
- Removing the floating variant breaks any page other than docs layout
  (unexpected consumer — usage assumption false).

## Maintenance notes

- Plan 003's executor should be told these components exist (`Callout`,
  `Tabs`) — update 003's "Suggested executor toolkit" or PR notes when this
  lands first.
- If a marketing landing page is ever built (revisiting the recorded "docs are
  the site" decision), the floating navbar is in git history at `fe6fb92` —
  restore rather than rewrite.
- Reviewer: check Callout contrast in dark mode (tinted backgrounds are the
  usual failure) and that Tabs don't trap keyboard focus.
