# Plan 012: Plugin registry page — GitHub repos tagged `ap-sdk-plugin`, pi.dev/packages-style

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
- **Risk**: MED — external API dependency (GitHub search) with rate limits;
  page must degrade gracefully
- **Depends on**: none hard. Supersedes plan 008 (hand-curated showcase).
  Plan 007's template repo should ship with the `ap-sdk-plugin` topic
  pre-applied once it exists.
- **Category**: direction
- **Planned at**: commit `fe6fb92`, 2026-07-01

## Why this matters

`ap-sdk install owner/repo` can install any plugin from GitHub
(`packages/agent-plugin-sdk/src/github.ts`), but there is no way to *discover*
plugins. The model to copy is pi.dev/packages: a self-serve catalog — cards
with name, description, author, freshness, links, and a copyable install
command, plus filter/sort. Where pi.dev is driven by npm publishes, this
registry is driven by a **GitHub topic**: any repo tagged `ap-sdk-plugin`
appears automatically, sorted by stars. Zero curation cost, and every listed
author gets distribution — the reason to build on ap-sdk in the first place.
This supersedes plan 008's hand-curated MDX page with the same "get listed via
topic" loop made automatic.

Plugins split into two distribution channels, and each card must reflect its
channel(s): **git-only** (the repo is the distribution — install with
`npx ap-sdk install owner/repo`) and **npm-published** (the author also ships
the plugin as an npm package, discovered via the `ap-sdk-plugin` npm
*keyword*). Today the SDK has no npm install source — that's plan 013
(`ap-sdk install npm:<package>`); until it lands, npm-channel cards badge and
link the package rather than showing a second install command.

## Current state

- **Reference UX (pi.dev/packages, observed 2026-07-01)**: header + one-line
  "how to install" intro; "Recently published" strip; "All packages" list with
  count, text filter ("Filter packages by name, description, or author"), type
  filter, sort select (downloads / recent / A-Z), pagination; each card =
  name (links to detail), description, author, downloads/mo, published-ago,
  type badge, `npm`/`repo`/`report` links, and a copyable
  `$ pi install npm:<package>` line. This plan builds the single-page version:
  card grid + text filter + sort toggle, **no per-plugin detail pages, no
  pagination** in v1 (topic search won't exceed ~100 repos for a while;
  `per_page=100` covers it — note the follow-up in Maintenance).
- **Standalone-route pattern to copy**: `apps/docs/src/app/docs/changelog/page.tsx`
  — a server component under the docs layout: `export const metadata`, then a
  page shell using the exact header markup of MDX pages
  (`max-w-[88rem]` grid → `max-w-[48rem]` column → bordered title block:
  `text-3xl font-bold tracking-tight` h1 + `text-lg leading-8
  text-muted-foreground` description). A registry wants more width — use the
  outer `max-w-[88rem]` grid but let the card grid span wider than
  `max-w-[48rem]` (e.g. `max-w-[64rem]`); keep the title block styling.
- **Nav wiring for standalone routes**: `src/lib/docs-nav.ts` appends the
  Changelog by hand at the end of `getDocsNav()`:
  ```ts
  const changelog: DocsNavItem = { title: "Changelog", url: "/docs/changelog" };
  ```
  Add the registry the same way. The navbar links array
  (`LINKS` in `src/components/site-navbar.tsx`) and footer links
  (`src/components/site-footer.tsx`) are simple arrays — add a "Plugins" entry
  to each.
- **GitHub API**: `GET https://api.github.com/search/repositories?q=topic:ap-sdk-plugin&sort=stars&order=desc&per_page=100`
  with headers `Accept: application/vnd.github+json` and (when
  `process.env.GIT_TOKEN` is set) `Authorization: Bearer ${GIT_TOKEN}` — the
  **same env var** `[[...slug]]/page.tsx` already uses for
  `getGithubLastEdit`. Unauthenticated search is 10 req/min; cached fetches
  make this a non-issue: use Next's fetch cache with
  `next: { revalidate: 3600 }` so the page is static + hourly ISR.
  Relevant response fields per item: `full_name`, `name`, `owner.login`,
  `owner.avatar_url`, `description`, `stargazers_count`, `pushed_at`,
  `html_url`, `topics`.
- **Install command per card**: `npx ap-sdk install owner/repo` — the syntax
  from `packages/agent-plugin-sdk/src/cli.ts` HELP and `src/github.ts`
  (`parseGithubSpec` accepts bare `owner/repo`). **The SDK accepts only local
  paths and GitHub specs today** (`isGithubSpec` is the sole remote gate in
  `cli.ts`); there is no npm source — see plan 013.
- **npm channel discovery**: npm registry search API —
  `GET https://registry.npmjs.org/-/v1/search?text=keywords:ap-sdk-plugin&size=250`
  — no auth, generous rate limits. Relevant fields per result object:
  `package.name`, `package.version`, `package.description`, `package.date`,
  `package.links.repository` (may be absent), `package.publisher.username`.
  Merge key against GitHub results: normalize `links.repository` to
  `owner/repo` (strip protocol/`.git`) and match `full_name`
  case-insensitively. npm-only results (keyword set but repo untagged or
  missing) still get a card — channel `npm` only.
- **Copy-button precedent**: `src/components/code-line.tsx` +
  `code-line-copy-button.tsx` render a single-line command with a copy action —
  reuse `CodeLine` for the card's install command if its props fit (read the
  file); otherwise mirror its copy-state pattern (Check/Copy icon swap).
- **Styling conventions**: `cn()`, `border-border/60`, `bg-card/60`,
  muted-foreground, `rounded-xl` cards (see `DocsMobileNav`), lucide icons
  (`Star` exists in lucide). Card hover: `hover:bg-accent/50` as in the
  sidebar.
- **Seeding reality**: as of planning, **zero repos carry the topic**. The
  in-repo examples live inside this monorepo and can't be topic-tagged
  individually — so the empty state is the launch state and must sell the
  action: "Tag your repo with the `ap-sdk-plugin` topic and it appears here
  within the hour." Tagging this monorepo itself with `ap-sdk-plugin` is an
  operator decision (it would make the SDK repo the first card) — surface it
  in the PR description, don't do it from code.
- Docs app is private — **no `.tegami/` changelog**.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install deps | `pnpm install` | exit 0 |
| Probe the API | `curl -s "https://api.github.com/search/repositories?q=topic:ap-sdk-plugin&per_page=5" \| head -40` | JSON with `total_count` (likely 0 items today) |
| Dev server | `pnpm --filter @jal-co/docs dev` | serves on localhost |
| Typecheck | `pnpm turbo typecheck --filter=@jal-co/docs` | exit 0 |
| Full gate | `pnpm turbo typecheck test lint build` | all tasks pass |

## Scope

**In scope** (the only files you should modify/create):

- `apps/docs/src/app/docs/plugins/page.tsx` (create — server component: fetch + shell)
- `apps/docs/src/lib/github-plugins.ts` (create — typed fetcher)
- `apps/docs/src/components/plugin-directory.tsx` (create — client component: filter/sort/cards over server-fetched data)
- `apps/docs/src/lib/docs-nav.ts` (append the Plugins nav item)
- `apps/docs/src/components/site-navbar.tsx` (`LINKS` array entry)
- `apps/docs/src/components/site-footer.tsx` (`links` array entry)
- `apps/docs/content/docs/installing-plugins.mdx` (one cross-link)

**Out of scope** (do NOT touch / do NOT build):

- Per-plugin detail pages, pagination, download counts, a "report" flow —
  v2 material (report needs an issue template first; note in Maintenance).
- Any validation that listed repos actually pass `ap-sdk check` — v1 lists
  what the topic returns; automated vetting is deferred (see Maintenance).
- `packages/agent-plugin-sdk/**`.
- Plan 008's `showcase.mdx` — superseded; if it was already executed, this
  plan **replaces** it: delete `showcase.mdx` + its `meta.json` entry and
  redirect links (add those files to scope in that case and say so in the PR).

## Git workflow

- Branch: `feat/plugin-registry-page`
- Commit style: `feat(docs): plugin registry page driven by the ap-sdk-plugin topic`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Typed fetcher

Create `src/lib/github-plugins.ts`:

```ts
export type PluginChannel = "github" | "npm";
export interface PluginEntry {
  id: string;            // "owner/repo" or npm name for npm-only entries
  fullName: string | null; // "owner/repo" (null for npm-only with no repo link)
  name: string;
  owner: string;         // repo owner or npm publisher
  avatarUrl: string | null;
  description: string | null;
  stars: number | null;  // null for npm-only entries
  updatedAt: string;     // ISO — pushed_at or package.date
  repoUrl: string | null;
  npmName: string | null;    // set when the npm channel is present
  npmVersion: string | null;
  channels: PluginChannel[]; // at least one
  topics: string[];
}
export async function fetchPluginEntries(): Promise<PluginEntry[] | null>;
```

- Fetch **both** sources in parallel (`Promise.allSettled`), each with
  `next: { revalidate: 3600 }`: the GitHub topic search (auth header only when
  `GIT_TOKEN` is set) and the npm keyword search (no auth).
- Merge: GitHub results are the base entries (`channels: ["github"]`); each
  npm result whose normalized `links.repository` matches a base entry's
  `full_name` enriches it (`npmName`, `npmVersion`, push `"npm"`); unmatched
  npm results become npm-only entries (`channels: ["npm"]`, `stars: null`).
- **Both** sources failing → return `null` (degraded state). One failing →
  proceed with the other and log a server-side warning; never crash the build
  (wrap in try/catch).
- Filter out archived (`archived: true`) and forked (`fork: true`) GitHub
  repos.

**Verify**: `pnpm turbo typecheck --filter=@jal-co/docs` → exit 0.

### Step 2: Page shell

Create `src/app/docs/plugins/page.tsx` modeled on `changelog/page.tsx`:

- `metadata`: title "Plugins", description "Community plugins built with
  ap-sdk — tag your repo ap-sdk-plugin to get listed."
- Server component: `const repos = await fetchPluginRepos();`
- Header block (changelog markup): h1 "Plugins", description line, plus an
  intro row with the general install pattern as a copyable line
  (`npx ap-sdk install owner/repo`) and a sentence linking
  `/docs/installing-plugins`.
- Render `<PluginDirectory entries={entries ?? []} degraded={entries === null} />`.
- **"Get listed" section** (always rendered, below the directory): two
  channel paths — **On GitHub**: 1. your repo has a `plugin.ts` that passes
  `npx ap-sdk check`; 2. add the `ap-sdk-plugin` **topic** (About → ⚙ →
  Topics). **On npm** (optional, for plugins also published as a package):
  add `"ap-sdk-plugin"` to the `keywords` array in `package.json` before
  publishing. Either/both appear here within the hour (hourly refresh). Link
  plan 007's template repo here once it exists (leave a plain sentence, no
  dead link).

**Verify**: dev server — `/docs/plugins` renders header + empty/degraded state.

### Step 3: Directory component

Create `src/components/plugin-directory.tsx` (client):

- Props: `{ entries: PluginEntry[]; degraded: boolean }`.
- Controls row (only when `entries.length > 0`): text input filtering on
  name/description/owner (case-insensitive substring, client-side), a channel
  filter (All / GitHub / npm — segmented control or select), and a sort
  select: **Stars** (default; npm-only entries sort after starred ones) /
  **Recently updated** (`updatedAt` desc) / **A–Z**. Match input/button
  styling to existing components (border, focus-visible ring — copy from
  `docs-sidebar.tsx` conventions).
- Card grid (`sm:grid-cols-2`, wider container per "Current state"): each card
  a `rounded-xl border border-border/60 bg-card/60` block with:
  owner avatar when present (plain `img`, `size-5 rounded-full`) + name
  linking to `repoUrl` (or `https://www.npmjs.com/package/{npmName}` for
  npm-only entries; external, `rel="noreferrer"`), description (line-clamped),
  meta row — `Star` icon + count (omit when `stars === null`), "updated
  {relative time}" (derive with `Intl.RelativeTimeFormat`; no date lib),
  **channel badges** (`git`, `npm` — small bordered pills), up to 3
  non-`ap-sdk-plugin` topics as badges — and the **install options**:
  - `github` channel → copyable `npx ap-sdk install {fullName}` (reuse
    `CodeLine` if suitable, else the copy-icon pattern from
    `code-line-copy-button.tsx`).
  - `npm` channel → if plan 013 has landed (npm source in the SDK), a second
    copyable line `npx ap-sdk install npm:{npmName}`; otherwise an `npm` link
    to the package page only. Gate this on a single boolean constant
    (`NPM_INSTALL_SUPPORTED`) at the top of the component with a comment
    pointing at plan 013, so flipping it is a one-line change.
  - npm-only entries (no repo) show whichever of the above applies and no
    GitHub command.
- States: `degraded` → "Couldn't reach GitHub — browse the topic directly"
  linking `https://github.com/topics/ap-sdk-plugin`; empty (not degraded) →
  a friendly "No plugins tagged yet — be the first" card pointing at the
  get-listed steps; filter-no-match → "No plugins match “{query}”".

**Verify**: dev server with mocked data — temporarily hardcode 4 fake
`PluginEntry` objects covering all three shapes (github-only, both channels,
npm-only) plus one more github-only (then remove) to confirm filter, channel
filter, all three sorts (including null-star ordering), per-channel install
options, copy button, and dark mode; then restore the real fetch and confirm
the empty state (today's reality).

### Step 4: Wire navigation

- `docs-nav.ts`: append `{ title: "Plugins", url: "/docs/plugins" }` next to
  the changelog append (keep Plugins before Changelog).
- `site-navbar.tsx` `LINKS`: add `{ label: "Plugins", href: "/docs/plugins" }`.
- `site-footer.tsx` `links`: same.
- `installing-plugins.mdx`: one line — "Looking for plugins? Browse the
  [plugin directory](/docs/plugins)."

**Verify**: dev server — Plugins appears in sidebar, navbar, footer; sidebar
marks it active on the route.

### Step 5: Gate

Confirm the production build succeeds **with the network blocked or the API
returning 0 items** (today's state already tests this): the page must
statically render the empty state without failing the build.

**Verify**: `pnpm turbo typecheck test lint build` → all tasks pass.

## Test plan

No test runner in the docs app. Verification: the Step 3 mocked-data QA
(filter/sort/copy/dark-mode), the real empty-state render, the degraded-state
render (temporarily point the fetcher at an invalid URL in dev, observe the
fallback, revert), and the build gate. Record all four in the PR description.

## Done criteria

- [ ] `/docs/plugins` renders: populated grid (mock QA), empty state, and degraded state correctly
- [ ] Data merges GitHub topic search + npm keyword search (`ap-sdk-plugin`), cached with hourly revalidation, auth header only on the GitHub call when `GIT_TOKEN` set
- [ ] One source failing still renders the other; both failing → degraded state
- [ ] Filter, channel filter, and three sorts work client-side; install options match each entry's channels (github command copyable; npm command gated on the plan-013 flag)
- [ ] "Get listed" steps rendered; nav/sidebar/footer/cross-link wired
- [ ] Build succeeds with zero API results (`pnpm turbo build --filter=@jal-co/docs`)
- [ ] No mock data left in the committed page (`rg -n "fake\|mock" apps/docs/src/app/docs/plugins` → 0)
- [ ] `pnpm turbo typecheck test lint build` exits 0
- [ ] No files outside the in-scope list modified (`git status`) — unless superseding an executed plan 008, stated in the PR
- [ ] `plans/README.md` status rows updated (this plan AND plan 008 → SUPERSEDED note)

## STOP conditions

Stop and report back if:

- The GitHub search API shape differs from the fields listed in "Current
  state" (verify with the curl probe first).
- The npm search API response doesn't carry `links.repository` in practice
  (probe with `curl -s "https://registry.npmjs.org/-/v1/search?text=keywords:ap-sdk-plugin&size=5"`
  — if the target keyword returns nothing, probe a populated keyword like
  `pi-package` to inspect the shape) — report before inventing a different
  merge key.
- Next's `revalidate` fetch caching conflicts with how this app is deployed
  (check `next.config.mjs` for `output: "export"` — a fully static export
  can't ISR; if found, fall back to build-time fetch + a "refreshed at build"
  note, and report the tradeoff).
- You're tempted to add a date/fetch library — the runtime covers both.

## Maintenance notes

- **Plan 008 is superseded by this page** — the index reflects it. If a
  curated "featured" strip is wanted later, it's a small constant array on top
  of this page, not a separate page.
- **When plan 013 lands, flip `NPM_INSTALL_SUPPORTED`** so npm-channel cards
  gain their copyable `npx ap-sdk install npm:<pkg>` line — a one-line change
  by design.
- v2 candidates, in rough order: pass the topic search through `ap-sdk check`
  in a scheduled job and badge validated plugins; a "report" link backed by an
  issue template (pi.dev has this); per-plugin detail pages; pagination past
  100 repos; npm download counts (`api.npmjs.org/downloads`) as a sort key.
- Operator follow-ups this plan surfaces but doesn't do: add the
  `ap-sdk-plugin` topic to the template repo (plan 007) and decide whether
  this monorepo gets the topic itself.
- The `GIT_TOKEN` env var is shared with the last-edited feature — if it's
  rotated/removed, both degrade gracefully, but search rate limits get tight;
  keep the token in the deploy environment.
