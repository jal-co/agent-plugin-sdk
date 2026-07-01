# Plan 013: Support npm as a plugin source — `ap-sdk install npm:<package>`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fe6fb92..HEAD -- packages/agent-plugin-sdk/src packages/agent-plugin-sdk/test`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — network fetch + tarball extraction of third-party content;
  must mirror the existing GitHub path's safety properties exactly
- **Depends on**: none (plan 012's registry gates its npm install command on
  this landing — flip its `NPM_INSTALL_SUPPORTED` flag afterward)
- **Category**: dx / direction
- **Planned at**: commit `fe6fb92`, 2026-07-01

## Why this matters

Plugin authors distribute one of two ways: a GitHub repo, or an npm package
(often both — npm gives them versioning, provenance, and download stats). The
SDK can consume the first (`ap-sdk install owner/repo`) but not the second:
`cli.ts` routes remote specs exclusively through `isGithubSpec`. So an
npm-published plugin has **no one-liner install at all** — the consumer would
have to `npm pack`/extract by hand. `ap-sdk install npm:<package>` closes the
gap, mirrors the convention users already know from pi
(`pi install npm:<package>`), and lets the plan-012 registry show a copyable
install command for npm-channel plugins.

## Current state

- **The GitHub source module is the exact template**:
  `packages/agent-plugin-sdk/src/github.ts` (195 lines) —
  - `parseGithubSpec(spec)` → `{ owner, repo, ref } | null`;
  - `isGithubSpec(spec)` — spec-vs-local-path disambiguation (bare
    `owner/repo` only counts when it isn't an existing local path and doesn't
    end in a JS/TS extension);
  - `fetchGithubPlugin(spec, { path })` — downloads a tarball to
    `mkdtempSync(join(tmpdir(), …))`, extracts with `tar`'s `x`
    (`tarExtract`) through `createGunzip()` + `pipeline`, locates the plugin
    file via `locatePlugin`/`DEFAULT_PLUGIN_FILES` (`src/plugin-files.ts`),
    returns `{ pluginPath, label, cleanup }`.
  Read the whole file before writing any code — the npm module must match its
  structure, error-message style, and cleanup contract.
- **CLI routing**: `src/cli.ts` `main()` —
  ```ts
  const remote = args.plugin ? isGithubSpec(args.plugin) : false;
  ...
  const fetched = await fetchGithubPlugin(spec, { path: args.path });
  pluginPath = fetched.pluginPath;
  sourceLabel = fetched.label;
  process.on("exit", fetched.cleanup);
  ```
  Remote sources then pass an explicit compatibility gate:
  `validatePlugin(plugin)` + `printCompatibility(plugin, sourceLabel)`, and
  `check` on a remote source is exactly that report. The npm path must flow
  through the **same** gate — extend the routing, don't fork it.
- **npm registry endpoints** (no auth):
  - Packument (choose version):
    `GET https://registry.npmjs.org/<name>` → `dist-tags.latest`,
    `versions[<v>].dist.tarball`;
  - or direct version doc:
    `GET https://registry.npmjs.org/<name>/<version-or-tag>` →
    `dist.tarball` (simpler — prefer this: one request with `latest` as the
    default tag).
  - Tarballs are gzipped tars with a **`package/` prefix on every path** —
    extraction needs `strip: 1` (the GitHub codeload tarball has the same
    property; check how `github.ts` handles the prefix and match).
- **Spec grammar to support**: `npm:<name>`, `npm:<name>@<version-or-tag>`,
  scoped packages `npm:@scope/name` and `npm:@scope/name@1.2.3` (the `@`
  after the scope's name is the version separator — split on the **last** `@`
  past index 0).
- **Where the plugin file lives in a package**: same `locatePlugin` walk over
  the extracted root, plus `--path` for monorepo-style packages — identical
  semantics to the GitHub path. Additionally, if the extracted `package.json`
  has an `ap-sdk` field naming the plugin file (`{ "ap-sdk": { "plugin":
  "./plugin.ts" } }`), prefer it — **decision**: include this field read
  (cheap, forward-looking, documented), but `locatePlugin` remains the
  fallback.
- **Deps**: `tar` and `yaml` already shipped; Node 18+ global `fetch` — no
  new dependencies.
- **HELP text**: `src/cli.ts` HELP documents the `plugin` argument's accepted
  forms — must gain the npm form.
- **Docs**: `apps/docs/content/docs/installing-plugins.mdx` documents GitHub
  sources; gains an npm section.
- **Tests**: `test/github.test.ts` exists — read it first to see how the
  GitHub module is tested (parse-level tests vs mocked fetch) and mirror the
  approach.
- Repo AGENTS.md: user-facing SDK feature → `.tegami/` changelog, **minor**.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install deps | `pnpm install` | exit 0 |
| Probe registry shape | `curl -s https://registry.npmjs.org/tar/latest \| head -c 400` | JSON with `dist.tarball` |
| SDK tests | `pnpm turbo test --filter=@jalco/ap-sdk` | all pass |
| Typecheck | `pnpm turbo typecheck --filter=@jalco/ap-sdk` | exit 0 |
| Full gate | `pnpm turbo typecheck test lint build` | all tasks pass |

## Scope

**In scope** (the only files you should modify/create):

- `packages/agent-plugin-sdk/src/npm.ts` (create — mirror of `github.ts`)
- `packages/agent-plugin-sdk/src/cli.ts` (HELP + remote routing)
- `packages/agent-plugin-sdk/test/npm.test.ts` (create)
- `apps/docs/content/docs/installing-plugins.mdx` (npm source section)
- `.tegami/2026-07-01-npm-source.md` (create)

**Out of scope** (do NOT touch):

- `src/github.ts` — **exception**: extracting a small shared helper (e.g. the
  tarball-download-and-extract routine) into a new `src/util/` module used by
  both is allowed *only if* it's a pure move; if the refactor grows beyond
  ~30 lines of churn, duplicate instead and note it.
- Publishing/registry *authoring* helpers (`ap-sdk publish`) — different
  feature.
- npm install via a package manager (`npm i` into the consumer's project) —
  this feature fetches and installs artifacts, exactly like the GitHub path;
  it does not touch the consumer's `package.json`.
- Private registries / `.npmrc` auth — v1 is the public registry; STOP if it
  turns out to be required.

## Git workflow

- Branch: `feat/npm-install-source`
- Commit style: `feat(sdk): install plugins from npm with npm:<package> specs`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Spec parsing

In `src/npm.ts`, implement and export:

```ts
export interface NpmSpec { name: string; version?: string } // version = exact or dist-tag
export function parseNpmSpec(spec: string): NpmSpec | null;
export function isNpmSpec(spec: string): boolean; // strict: /^npm:/i
```

Parsing rules (unit-test each): `npm:foo` → `{name:"foo"}`;
`npm:foo@1.2.3` → `{name:"foo",version:"1.2.3"}`; `npm:@scope/foo` →
`{name:"@scope/foo"}`; `npm:@scope/foo@next` →
`{name:"@scope/foo",version:"next"}`; reject empty names and names failing
npm's name rules (lowercase, URL-safe — a simple
`/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/` check is enough).
Unlike GitHub's bare `owner/repo`, the `npm:` prefix is mandatory — no
ambiguity with local paths, so `isNpmSpec` is a pure prefix test.

**Verify**: `pnpm turbo typecheck --filter=@jalco/ap-sdk` → exit 0.

### Step 2: Fetch + extract

Implement `fetchNpmPlugin(spec: string, options?: { path?: string })`
returning `{ pluginPath, label, cleanup }` — the same contract as
`fetchGithubPlugin` (read its implementation and mirror error handling,
temp-dir naming, and cleanup registration):

1. `GET https://registry.npmjs.org/<name>/<version ?? "latest">` — 404 →
   fail with `npm package "<name>" not found` (or version-specific message);
   other non-OK → include status in the error.
2. Download `dist.tarball`, extract through `createGunzip()` + `tarExtract`
   with the `package/` prefix stripped (match `github.ts`'s prefix handling).
3. Resolve the plugin file: `options.path` subdir if given → `package.json`'s
   `ap-sdk.plugin` field if present → `locatePlugin` walk. Not found → fail
   with the same style of message the GitHub path uses, plus a hint about the
   `ap-sdk.plugin` field.
4. `label` = `npm:<name>@<resolved version>` (read the concrete version from
   the version doc so `latest` resolves to a number in output).

**Verify**: `cd packages/agent-plugin-sdk && pnpm cli check npm:tar 2>&1 | head -3`
→ fails *gracefully* with the not-a-plugin/compatibility message (proves
fetch+extract+gate work end-to-end against a real package that isn't a
plugin; exact wording per the CLI's existing remote-incompatible branch).

### Step 3: CLI routing

In `src/cli.ts`:

- HELP: extend the `plugin` argument description with `npm:package[@version]`
  and add an example (`ap-sdk install npm:@acme/git-helper`).
- Routing: where `main()` computes `const remote = … isGithubSpec(…)`,
  generalize to detect npm specs too and dispatch to the matching fetcher;
  everything downstream (compat gate, `printCompatibility`, `check`
  short-circuit, `process.on("exit", cleanup)`) stays shared and untouched.
  `--ref` is GitHub-only — `fail` with a clear message if combined with an
  npm spec (`use npm:<name>@<version> instead`).

**Verify**: `pnpm cli check npm:definitely-not-a-real-pkg-xyz` → exits 1 with
the not-found message; `pnpm cli install --help`-equivalent (`pnpm cli --help`)
shows the npm form.

### Step 4: Tests

Create `test/npm.test.ts`, mirroring `test/github.test.ts`'s approach (read it
first — if it unit-tests parsing only, do the same and cover fetch behavior
with a mocked global `fetch` via `vi.stubGlobal`):

1. `parseNpmSpec` — the six cases from Step 1 (accept ×4, reject ×2).
2. `isNpmSpec` — `npm:foo` true; `./npm:weird` false; `owner/repo` false.
3. With mocked `fetch` + a fixture tarball built in-test (`tar.c` into a
   buffer with a `package/plugin.ts` entry): `fetchNpmPlugin` resolves
   `pluginPath` to the extracted plugin, label includes the resolved version,
   `cleanup()` removes the temp dir.
4. Mocked 404 → rejects with a message containing the package name.
5. `package.json` `ap-sdk.plugin` field takes precedence over `locatePlugin`
   (fixture tarball with both a root `plugin.ts` and a field pointing at
   `custom/entry.ts`).

**Verify**: `pnpm turbo test --filter=@jalco/ap-sdk` → all pass including the
new file.

### Step 5: Docs + changelog + gate

- `installing-plugins.mdx`: add an "From npm" section — spec forms, version
  pinning (`npm:name@1.2.3`), the `ap-sdk.plugin` package.json field, and the
  note that the compatibility check runs before anything is installed (same
  as GitHub sources).
- `.tegami/2026-07-01-npm-source.md`:

  ```md
  ---
  packages:
    "@jalco/ap-sdk": minor
  ---

  ## Install plugins from npm

  `ap-sdk install npm:<package>` (and `check`/`build` with the same spec)
  fetches a published package from the npm registry, verifies it's a
  compatible plugin, and installs it — with `npm:<package>@<version>` for
  pinning. Packages can point at a non-root plugin file via an
  `ap-sdk.plugin` field in package.json.
  ```

**Verify**: `pnpm turbo typecheck test lint build` → all tasks pass.

### Step 6: Notify the registry plan

If plan 012 already landed, flip its `NPM_INSTALL_SUPPORTED` constant in
`apps/docs/src/components/plugin-directory.tsx` to `true` (one line — this is
the documented hand-off; add the file to scope in your PR and say so). If 012
hasn't landed, note in `plans/README.md` that 013 landed first.

**Verify**: whichever branch applies is reflected in `plans/README.md`.

## Test plan

See Step 4 — parse-level unit tests plus mocked-fetch integration tests with
in-test fixture tarballs; pattern source `test/github.test.ts`. No live
network calls in the suite (Step 2/3's live probes are manual smoke checks,
recorded in the PR description).

## Done criteria

- [ ] `ap-sdk check npm:<real-non-plugin-pkg>` fails gracefully with the compatibility message (manual smoke, transcript in PR)
- [ ] All Step 4 tests pass; suite green
- [ ] `--ref` + npm spec → clear error
- [ ] HELP shows the npm form; docs page has the "From npm" section
- [ ] Shared compat gate untouched (`printCompatibility` / `validatePlugin` call sites unchanged for the GitHub path)
- [ ] `.tegami/2026-07-01-npm-source.md` exists with `minor` bump
- [ ] `pnpm turbo typecheck test lint build` exits 0
- [ ] No files outside the in-scope list modified (`git status`), Step 6 exception declared if taken
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `github.ts`'s structure differs materially from the "Current state" summary
  (drifted) — re-read before mirroring.
- The registry version-doc endpoint (`/<name>/<tag>`) is unavailable or
  shaped differently than probed — report; don't silently switch to full
  packuments without noting the payload-size tradeoff.
- Extraction of a fixture tarball writes outside the temp dir in any test
  (path traversal in an entry name) — that's a security finding; report
  immediately and check whether `tar`'s extract options already guard it
  (they should — `tar` v7 strips absolute paths and `..` by default; verify,
  and add an explicit test if the guarantee is configurable).
- Private-registry/auth support turns out to be needed for the acceptance
  smoke — v1 is public-registry only by design.

## Maintenance notes

- The `ap-sdk.plugin` package.json field is now public API surface — document
  it wherever plugin packaging docs land (plan 007's template repo should set
  it).
- If a shared tarball helper was extracted, both source modules now depend on
  it — changes to one source's extraction must run both test files.
- Future: `--registry` flag / `.npmrc` respect for private registries;
  provenance/signature checks; npm download counts feeding plan 012's sort.
