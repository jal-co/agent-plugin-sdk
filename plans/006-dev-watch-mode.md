# Plan 006: Add `ap-sdk dev` — watch the plugin and rebuild/reinstall on change

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
- **Risk**: MED — module-cache invalidation for re-imports is the tricky part
- **Depends on**: none (pairs well with 005: dev + uninstall = safe iteration loop)
- **Category**: dx
- **Planned at**: commit `fe6fb92`, 2026-07-01

## Why this matters

Plugin authors — the SDK's core audience — iterate by editing `plugin.ts`, then
manually re-running `ap-sdk build` and/or `ap-sdk install` and reopening their
harness. The SDK's own developers get `tsup --watch`; plugin authors get
nothing. `ap-sdk dev` closes the loop: watch the plugin module and its
dependencies (skill resource files, the tools module, files loaded via
`readText`/`readDir`), rebuild on change, and optionally reinstall — making the
edit→try cycle seconds instead of a command ritual.

## Current state

- `packages/agent-plugin-sdk/src/cli.ts`:
  - Commands: `build`, `install`, `check`, `tools`, `add-harness`, `port`.
  - `loadPlugin(path)` (~line 180) does a bare `await import(pathToFileURL(path).href)`.
    **ESM caches by URL** — re-importing the same path returns the stale module.
    A watch loop must bust the cache, e.g. by appending a unique query
    (`?t=${Date.now()}`) to the import URL. Verify `tsx`'s registered loader
    (see `enableTypeScript()`, ~line 165) tolerates the query param; if it
    doesn't, STOP condition.
  - `runBuild(plugin, args, pluginPath)` (~line 300) writes trees under
    `--out` (default `.aps-out`) via `writeTree` and prints warnings.
  - `runInstall(plugin, args)` calls `installSkills`.
- `src/build.ts` — `build(plugin, options)` is **pure** (in-memory trees), so
  rebuilding repeatedly is cheap and safe.
- File-loading helpers: plugins may inline content read at *module load time*
  via `readText`/`readTextFrom`/`readDir` (exported from the SDK; used heavily
  by ported plugins — see `apps/docs/content/docs/porting.mdx`). This means a
  change to a referenced markdown file only takes effect on re-import, and the
  watcher must watch those files too. Simplest correct scope for v1: watch the
  **plugin file's directory tree** (recursive), debounced, excluding the output
  dir and `node_modules`.
- Node ≥ 18 is the engine floor (`package.json` `engines`). `fs.watch` with
  `{ recursive: true }` works on macOS/Windows on 18+, and on Linux only from
  Node 20. Runtime deps are lean (`tar`, `tsx`, `yaml`) and the repo's global
  guidance is to avoid new deps when the runtime suffices — but a broken
  watcher on Linux+Node18 is worse; see Step 1 decision gate.
- Test conventions: vitest, temp-dir pattern in `test/install.test.ts:28-37`.
- Repo AGENTS.md: new CLI command → `.tegami/` changelog, **minor** bump.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install deps | `pnpm install` | exit 0 |
| SDK tests | `pnpm turbo test --filter=@jalco/ap-sdk` | all pass |
| Typecheck | `pnpm turbo typecheck --filter=@jalco/ap-sdk` | exit 0 |
| Full gate | `pnpm turbo typecheck test lint build` | all tasks pass |
| Manual smoke | see Step 4 | rebuild on file change |

## Scope

**In scope** (the only files you should modify/create):

- `packages/agent-plugin-sdk/src/dev.ts` (create — the watch loop, exported for testability)
- `packages/agent-plugin-sdk/src/cli.ts` — HELP + `dev` dispatch + `runDev`
- `packages/agent-plugin-sdk/test/dev.test.ts` (create)
- `apps/docs/content/docs/quickstart.mdx` — mention `ap-sdk dev` in the "try it locally" flow
- `.tegami/2026-07-01-dev-watch.md` (create)
- `packages/agent-plugin-sdk/package.json` — ONLY if Step 1 decides a watcher dep is required

**Out of scope** (do NOT touch):

- `src/build.ts`, `src/install.ts` — reuse as-is; no signature changes.
- Harness hot-reload (telling Claude Code etc. to reload) — harness-specific
  and out of reach; `dev` only refreshes the files on disk.
- A long-lived MCP dev server for `tools` — deferred.

## Git workflow

- Branch: `feat/dev-watch`
- Commit style: `feat(sdk): add ap-sdk dev watch mode`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Decision gate — watcher mechanism

Check the Node docs / runtime behavior for `fs.watch` recursive support on
Linux for the repo's engine floor (`node >= 18`).

- If targeting the floor honestly requires it, add the well-maintained
  `chokidar` (v4+, slim, no globs) as a dependency and record the reasoning in
  the commit body.
- Otherwise use `fs.watch({ recursive: true })` and document (HELP + docs) that
  `dev` requires Node 20+ on Linux.

Either way: one mechanism, implemented in `src/dev.ts`, debounced (~150ms),
ignoring the out dir, `node_modules`, `.git`, and dotfile dirs.

**Verify**: a one-line note in the commit message states the choice and why.

### Step 2: Implement the watch loop in `src/dev.ts`

Export:

```ts
export interface DevOptions {
  pluginPath: string;          // absolute
  targets?: HarnessId[];
  out?: string;                // default ".aps-out"
  install?: boolean;           // also run installSkills after each build
  scope?: InstallScope;        // for install
  onCycle?: (result: { ok: boolean; error?: Error; warnings: number }) => void; // test hook
  signal?: AbortSignal;        // stop the loop (tests + SIGINT)
}
export function startDev(options: DevOptions): Promise<void>;
```

Loop behavior:

1. Run one cycle immediately: fresh-import the plugin
   (`import(pathToFileURL(path).href + "?t=" + Date.now())`), validate, run
   `build`, write trees (reuse the same logic as `runBuild` — extract shared
   code from `cli.ts` into `dev.ts` or a small helper rather than duplicating
   the tools-module copy step: `readToolsModule` must apply here too).
2. Watch `dirname(pluginPath)` recursively; on a debounced change, rerun the
   cycle.
3. A cycle failure (import error, `PluginValidationError`) must **not** exit
   the loop — print the error (reuse the CLI's `✖`/warning styling) and keep
   watching. This is the whole point of a dev mode.
4. `install: true` → after a successful build, call `installSkills` with the
   same targets/scope and print a one-line confirmation.
5. Resolve when `signal` aborts.

**Verify**: `pnpm turbo typecheck --filter=@jalco/ap-sdk` → exit 0.

### Step 3: Wire the CLI

In `src/cli.ts`:

1. HELP: `ap-sdk dev     [plugin] [options]   Watch the plugin and rebuild on change`
   — note `--install` (rebuild straight into local harness dirs), plus the
   existing `--target/--out/--global` semantics; add an example
   (`ap-sdk dev --install -t claude`).
2. Add `--install` to `Args` parsing.
3. `runDev`: resolve the plugin path (local only — **reject GitHub specs** with
   `fail("dev requires a local plugin")`), call `startDev` with an
   `AbortController` wired to SIGINT, print a startup banner
   (`Watching <dir> — Ctrl-C to stop`).

**Verify**: `pnpm turbo build --filter=@jalco/ap-sdk` → exit 0;
`node dist/cli.js --help | grep "dev"` → present.

### Step 4: Manual smoke test

In a temp dir with a scaffolded plugin (from plan 002's `init`, or copy
`examples/git-helper/plugin.ts`):

1. `node <repo>/packages/agent-plugin-sdk/dist/cli.js dev` → initial build
   output appears, process stays alive.
2. Edit the skill description → within ~1s a rebuild line appears; the emitted
   `SKILL.md` under `.aps-out/claude/` contains the new text.
3. Introduce a syntax error → cycle prints an error, process still alive; fix
   it → next cycle succeeds (proves cache-busting works).
4. Ctrl-C exits 0.

**Verify**: all four behaviors observed; paste the terminal transcript into the
PR description.

### Step 5: Tests

Create `test/dev.test.ts` using `startDev` directly (temp-dir pattern from
`test/install.test.ts:28-37`; use `onCycle` + `AbortController`, generous
timeouts — watchers are timing-sensitive; keep assertions on cycle results, not
wall-clock):

1. Initial cycle builds: `onCycle` fires with `ok: true`; output tree exists.
2. Changing the plugin file triggers a new cycle with the updated content
   (assert the emitted file changed).
3. A plugin file with a validation error yields `ok: false` and the loop
   survives to a subsequent successful cycle after the file is fixed.
4. Abort resolves the `startDev` promise.

If watcher-based tests prove flaky in CI after a reasonable attempt, keep test
1 and 4 (no watching involved beyond startup/teardown), convert 2 and 3 to the
documented manual smoke (Step 4), and note it in the plan status — do NOT ship
flaky tests.

**Verify**: `pnpm turbo test --filter=@jalco/ap-sdk` → all pass, repeated 3×
locally (`for i in 1 2 3; do pnpm turbo test --filter=@jalco/ap-sdk || break; done`).

### Step 6: Docs + changelog

- `quickstart.mdx`: in "## 4. Try it locally", add `npx ap-sdk dev --install -t claude`
  with one sentence.
- `.tegami/2026-07-01-dev-watch.md`:
  ```md
  ---
  packages:
    "@jalco/ap-sdk": minor
  ---

  ## Add `ap-sdk dev`

  Watch mode for plugin authors: `ap-sdk dev` rebuilds on every change to the
  plugin and its referenced files, and `--install` drops the result straight
  into your local harness dirs. Errors keep the watcher alive.
  ```

**Verify**: `pnpm turbo typecheck test lint build` → all tasks pass.

## Test plan

See Step 5 (4 cases + flake fallback policy) and the Step 4 manual smoke
transcript. Pattern: `test/install.test.ts` temp-dir setup.

## Done criteria

- [ ] `ap-sdk dev` runs the initial build and rebuilds on change (Step 4 transcript)
- [ ] Broken plugin → error printed, loop survives, recovers on fix
- [ ] `--install` reinstalls after each successful build
- [ ] GitHub specs rejected with a clear error
- [ ] New tests pass 3× consecutively
- [ ] `.tegami/2026-07-01-dev-watch.md` exists with `minor` bump
- [ ] `pnpm turbo typecheck test lint build` exits 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The `tsx` loader rejects or mis-handles query-param cache busting
  (`plugin.ts?t=...`) — the re-import strategy is the plan's key assumption;
  report alternatives (child-process-per-cycle) rather than improvising one.
- `cli.ts`'s `loadPlugin`/`runBuild` don't match the "Current state" summary.
- Watcher tests are flaky AND the fallback in Step 5 still leaves the suite
  unstable.
- You want to change `build()`/`installSkills` signatures — out of scope.

## Maintenance notes

- If cache-busted re-imports leak memory over very long sessions (each import
  is a new module instance), the fix is a child process per cycle — noted here
  so a future "dev mode leaks" report has its answer.
- When plan 005's manifest lands, `dev --install` cycles will rewrite the
  manifest each time — confirm that stays idempotent.
- Deferred: watching files outside the plugin dir referenced by absolute path;
  a `--serve-mcp` dev server for tools.
