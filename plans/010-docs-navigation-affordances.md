# Plan 010: Docs navigation affordances — search UI (⌘K), prev/next, edit-this-page

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
- **Depends on**: none (do before or alongside 003/004 — the site is about to
  grow from 8 to ~20 pages, which is what makes search/prev-next urgent)
- **Category**: dx / docs
- **Planned at**: commit `fe6fb92`, 2026-07-01

## Why this matters

The docs site has a **working search backend and no search UI**: the Orama
endpoint exists at `/api/search` and `flexsearch` is installed, but there is no
search dialog, no navbar search button, and no ⌘K binding — the single
most-expected docs interaction is missing while its server half sits unused.
Pages are also dead ends (no prev/next links), and the page already queries the
GitHub API for "last edited" but never offers an "edit this page" link — a free
contribution funnel. All three land in one plan because they touch the same few
files.

## Current state

- **Search backend**: `apps/docs/src/app/api/search/route.ts` (complete file):
  ```ts
  import { createFromSource } from "fumadocs-core/search/server";
  import { source } from "@/lib/source";

  export const { GET } = createFromSource(source, {
    language: "english",
  });
  ```
  `fumadocs-core@16.10.6` is installed; its client half is the
  `useDocsSearch` hook (`fumadocs-core/search/client`) which talks to this
  route. `fumadocs-ui` is also installed (16.10.6) but the site deliberately
  does **not** use its components — every component is hand-rolled
  (jalco-ui style, see headers in `src/components/*.tsx`).
- **Navbar**: `src/components/site-navbar.tsx` — `Actions()` renders
  ThemeToggle, a GitHub icon button, and a "Get started" CTA. No search
  trigger. Buttons use the local `Button` (`src/components/ui/button.tsx`)
  with `radix-ui` primitives available (`radix-ui@1.6.0` — the monolithic
  package; `DropdownMenu` is already imported from it in
  `src/components/ai-copy-button.tsx`, so `Dialog` is available the same way).
- **Docs page**: `src/app/docs/[[...slug]]/page.tsx` — renders title/description
  header, `<MDX/>`, and a right rail (`hidden xl:block`) containing `DocsToc`,
  `AiCopyButton`, and a "Last edited {date}" line fed by
  `getGithubLastEdit({ owner: gitConfig.user, repo: gitConfig.repo, path:
  \`apps/docs/content/docs/${page.path}\` })`. Content ends after `<MDX/>` —
  no pagination footer.
- **Nav data**: `src/lib/docs-nav.ts` — `getDocsNav(): DocsNavGroup[]` builds
  ordered, serializable `{ title?, items: { title, url }[] }` groups from the
  Fumadocs page tree (and appends the standalone Changelog route by hand).
  Flattening `groups.flatMap(g => g.items)` yields the exact prev/next order.
- **Repo/edit URL config**: `src/lib/shared.ts` —
  `gitConfig = { user: "jal-co", repo: "agent-plugin-sdk", branch: "main" }`.
  An edit URL is
  `https://github.com/{user}/{repo}/edit/{branch}/apps/docs/content/docs/{page.path}`.
- **Styling conventions**: Tailwind v4 classes, `cn()` from `src/lib/utils`,
  focus rings as in `docs-sidebar.tsx`
  (`focus-visible:ring-2 focus-visible:ring-ring/50`), muted-foreground text,
  `border-border/60` hairlines. Match these.
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

- `apps/docs/src/components/search-dialog.tsx` (create)
- `apps/docs/src/components/site-navbar.tsx` (add search trigger)
- `apps/docs/src/components/docs-pagination.tsx` (create — prev/next footer)
- `apps/docs/src/app/docs/[[...slug]]/page.tsx` (render pagination + edit link)
- `apps/docs/src/lib/docs-nav.ts` (add a helper returning the flat ordered list, if needed)

**Out of scope** (do NOT touch):

- `src/app/api/search/route.ts` — the backend works; leave it.
- Importing components from `fumadocs-ui` — the site's design system is
  hand-rolled; use `fumadocs-core` hooks + local components only.
- `content/docs/**`, `mdx.tsx`, code-block components — plan 011's territory.
- Search analytics, keyboard-nav beyond the dialog basics, recent-searches
  persistence — v2 material.

## Git workflow

- Branch: `feat/docs-search-nav`
- Commit style: `feat(docs): search dialog, prev/next pagination, edit links`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Build the search dialog

Create `src/components/search-dialog.tsx` (client component):

- Use `Dialog` from `radix-ui` (same import pattern as `DropdownMenu` in
  `ai-copy-button.tsx`) and `useDocsSearch` from `fumadocs-core/search/client`
  (check the installed 16.10.6 API surface in
  `node_modules/fumadocs-core/dist/search/client*` — verify the hook's exact
  signature/return shape there before coding; it exposes query state and
  results for the `fetch`/static client pointed at `/api/search`).
- UI: centered dialog, an input (auto-focused), result list grouped as the API
  returns (page + heading hits), each result a link that closes the dialog on
  navigate. Empty query → hint text; no results → "No results for …".
- Keyboard: `⌘K`/`Ctrl+K` global listener to open (register in the component
  via `useEffect` on `window`), `Esc` closes (Radix default), `Enter` follows
  the highlighted result, arrow keys move the highlight. Keep highlight logic
  simple (index state over the flat result array).
- Export both the dialog and a `SearchTrigger` button: a bordered, muted
  "Search docs…" pill with a `⌘K` kbd hint on `md+`, and an icon-only variant
  for mobile. Style with the conventions from "Current state".

**Verify**: `pnpm turbo typecheck --filter=@jal-co/docs` → exit 0.

### Step 2: Mount it in the navbar

In `site-navbar.tsx`, render the trigger + dialog in `Actions()` (before
ThemeToggle) for **both** variants (docs and floating), so the feature
survives if a landing page ever revives the floating variant.

**Verify**: dev server — on `/docs`, the trigger renders; clicking it and
pressing `⌘K` both open the dialog; typing `port` returns results linking to
the porting page; `Esc` closes; result click navigates and closes.

### Step 3: Prev/next pagination

- In `src/lib/docs-nav.ts`, export
  `getDocsNavFlat(): DocsNavItem[]` = `getDocsNav().flatMap(g => g.items)`.
- Create `src/components/docs-pagination.tsx` (server-safe, no client hooks
  needed if given the current URL as a prop): given `current: string`, find
  its index in the flat list; render a two-cell footer — left card "← Previous
  / {title}", right card "Next / {title} →" — cards styled like the sidebar
  hover states (`rounded-lg border border-border/60 hover:bg-accent/50`).
  Omit a cell at either end; render nothing if the page isn't in the list
  (e.g. a standalone route).
- In `[[...slug]]/page.tsx`, render `<DocsPagination current={page.url} />`
  after the prose `div`, inside the `max-w-[48rem]` column, separated by a top
  border (`mt-12 border-t border-border/60 pt-8`).

**Verify**: dev server — `/docs/quickstart` shows Previous → Installation and
Next → Installing a plugin (per current `meta.json` order); first page has no
Previous; last nav item (Changelog) has no Next.

### Step 4: Edit-this-page link

In `[[...slug]]/page.tsx`, in the right-rail block next to the "Last edited"
line, add:

```tsx
<a
  href={`https://github.com/${gitConfig.user}/${gitConfig.repo}/edit/${gitConfig.branch}/apps/docs/content/docs/${page.path}`}
  target="_blank"
  rel="noreferrer"
  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
>
  Edit this page on GitHub
</a>
```

Render it unconditionally (unlike last-edited, it needs no API call).

**Verify**: dev server — link present on `/docs/quickstart` and its href ends
with `/edit/main/apps/docs/content/docs/quickstart.mdx`.

### Step 5: Gate + manual QA pass

Manual QA on the dev server: dialog on mobile viewport (trigger reachable,
dialog usable), dark mode rendering of dialog/pagination/edit link, tab focus
order through the new navbar trigger.

**Verify**: `pnpm turbo typecheck test lint build` → all tasks pass.

## Test plan

The docs app has no test runner (no vitest config; `turbo test` has no docs
task) — verification is typecheck + biome lint + the scripted manual QA in
Steps 2/3/4/5. Record the QA checklist results in the PR description.

## Done criteria

- [ ] ⌘K / Ctrl+K opens search on any docs page; results navigate correctly
- [ ] Search trigger visible in the navbar on desktop and mobile
- [ ] Every MDX docs page shows correct prev/next per sidebar order; ends truncate properly
- [ ] Edit-this-page link on every MDX docs page with a valid `/edit/` URL
- [ ] No `fumadocs-ui` component imports (`rg "from \"fumadocs-ui" apps/docs/src` → 0 matches)
- [ ] `pnpm turbo typecheck test lint build` exits 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `useDocsSearch` in the installed `fumadocs-core@16.10.6` doesn't match a
  usable client API for the `createFromSource` route after reading the
  package's dist/types — report what the installed version actually exports
  rather than upgrading packages.
- The search route returns errors in dev (backend assumption false).
- Radix `Dialog` isn't exported by the installed monolithic `radix-ui` package
  — report; don't add `@radix-ui/react-dialog` without flagging the new dep.

## Maintenance notes

- When plans 003/004/012 add pages/routes, pagination and search pick them up
  automatically (both derive from the page tree / search index) — but
  standalone routes (changelog-style pages) only appear in prev/next if
  `docs-nav.ts` appends them, and only appear in search if indexed; note this
  in any new standalone route's PR.
- The ⌘K listener is a global window binding — if a second global shortcut is
  ever added, centralize them in one hook to avoid conflicts.
- Reviewer: check the dialog closes on route change (Next.js app-router
  navigation) — a common leak.
