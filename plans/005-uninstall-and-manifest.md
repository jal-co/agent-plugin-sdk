# Plan 005: Add `ap-sdk uninstall` backed by an install manifest

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
- **Risk**: MED — deleting files in user harness dirs; must never remove
  anything the plugin didn't write
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `fe6fb92`, 2026-07-01

## Why this matters

`ap-sdk install` writes files into up to eight harness directories (`.claude/`,
`.cursor/`, `~/.codex/`, …) and merges blocks into shared config files — but
keeps no record and offers no removal path. A user who tries the tool and wants
to back out must hand-hunt files across eight directory conventions. That makes
people hesitant to run `install` at all. An install manifest plus an
`uninstall` command makes trying the tool a reversible, low-stakes act.

## Current state

- `packages/agent-plugin-sdk/src/install.ts` — `installSkills(plugin, options)`
  returns `InstalledItem[]`:
  ```ts
  export interface InstalledItem {
    harness: HarnessId;
    kind: "skill" | "command" | "mcp" | "context" | "subagent" | "hook" | "file";
    name: string;
    /** Absolute paths written (or that would be written, in dry-run). */
    files: string[];
    note?: string;
  }
  ```
  So **the data needed for a manifest already exists** — it's returned and then
  discarded.
- Three write modes exist, and uninstall must treat them differently:
  1. **Whole files owned by the plugin** — skills (`installSkill`), commands
     (`installCommand`), subagents (`installSubagent`), companion files
     (`installFiles`). Safe to delete the exact paths recorded.
  2. **Merged markdown block** — `mergeMarkdownBlock(file, pluginId, instructions)`
     wraps instructions in `<!-- agent-plugin-sdk:<id> START -->` /
     `<!-- agent-plugin-sdk:<id> END -->` markers and replaces idempotently.
     Uninstall = remove the marker block, keep the rest of the file.
  3. **Merged JSON keys** — `mergeJsonKey` (MCP servers into e.g.
     `.mcp.json`/`opencode.json` under a `mergeKey`) and `mergeHooksInto`
     (hook groups appended per event into a `hooks` key, deduped by
     `JSON.stringify`). Uninstall = remove exactly the entries/groups this
     plugin contributed, preserve everything else.
- `src/cli.ts` — command surface: `build`, `install`, `check`, `tools`,
  `add-harness`, `port`. `runInstall(plugin, args)` (~line 380) prints the
  install report. Errors go through `fail()` (prints `✖`, exit 1).
- Install scopes: `"project"` (cwd-relative dirs) and `"global"` (`~`-based) —
  `InstallScope` in `src/harnesses/types.ts`.
- Test pattern for filesystem tests: `test/install.test.ts:28-37` —
  `mkdtempSync(join(tmpdir(), "aps-install-"))` + `process.chdir` in
  `beforeEach`, cleanup in `afterEach`. `test/install-files.test.ts` also
  exists; model new tests on these.
- Repo AGENTS.md: new CLI command → `.tegami/` changelog, **minor** bump.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install deps | `pnpm install` | exit 0 |
| SDK tests | `pnpm turbo test --filter=@jalco/ap-sdk` | all pass |
| Typecheck | `pnpm turbo typecheck --filter=@jalco/ap-sdk` | exit 0 |
| Full gate | `pnpm turbo typecheck test lint build` | all tasks pass |

## Scope

**In scope** (the only files you should modify/create):

- `packages/agent-plugin-sdk/src/install.ts` — write the manifest at the end of a non-dry-run install
- `packages/agent-plugin-sdk/src/uninstall.ts` (create)
- `packages/agent-plugin-sdk/src/cli.ts` — HELP + `uninstall` dispatch + `runUninstall`
- `packages/agent-plugin-sdk/src/index.ts` — export `uninstallPlugin` (match how `installSkills` is exported)
- `packages/agent-plugin-sdk/test/uninstall.test.ts` (create)
- `apps/docs/content/docs/installing-plugins.mdx` — document uninstall
- `.tegami/2026-07-01-uninstall.md` (create)

**Out of scope** (do NOT touch):

- `src/harnesses/*.ts` — no per-harness changes; uninstall works from recorded
  paths, not from harness knowledge.
- Cleaning up installs made by **older SDK versions** (no manifest exists) —
  explicitly unsupported in v1 of this feature; the command reports "no
  manifest found" and exits cleanly.
- `build` output (`.aps-out/`) — that's the user's to delete.

## Git workflow

- Branch: `feat/uninstall-manifest`
- Commit style: `feat(sdk): record installs in a manifest and add ap-sdk uninstall`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Design + write the manifest on install

In `src/install.ts`, after the target loop in `installSkills`, when
`!options.dryRun`, write a manifest capturing what was just installed:

- Location: project scope → `<cwd>/.ap-sdk/install-manifest.json`; global scope
  → `~/.ap-sdk/install-manifest.json`. (One fixed, documented location per
  scope; do NOT scatter per-harness manifests.)
- Shape (versioned for forward compatibility):
  ```json
  {
    "version": 1,
    "plugins": {
      "<plugin-id>": {
        "installedAt": "<ISO date>",
        "scope": "project",
        "items": [ { "harness": "claude", "kind": "skill", "name": "diff-review", "files": ["/abs/path/..."] } ]
      }
    }
  }
  ```
  `items` is exactly the returned `InstalledItem[]` (minus `note`). Merge-write:
  read existing manifest if present (tolerate/refuse invalid JSON the same way
  `mergeJsonKey` does — throw with a "Refusing to overwrite" message), replace
  the entry for this plugin id, preserve other plugins' entries.
- For merged writes (`kind: "context"`, `"mcp"`, `"hook"`) the recorded `files`
  entry is the merged config path; record enough to reverse them: add an
  optional `detail` field on the manifest item — for `mcp`: the server names
  installed; for `hook`: the native hook groups contributed (the
  `config.hooks` object passed to `mergeHooksInto`); for `context`: nothing
  extra (the marker block is derivable from the plugin id). Thread this data
  out of `installMcp`/`installHooks` — extend `InstalledItem` with an optional
  `detail?: unknown` rather than inventing a parallel structure.

**Verify**: `pnpm turbo test --filter=@jalco/ap-sdk` → existing tests still
pass (they call `installSkills` in temp dirs; a new `.ap-sdk/` dir in the temp
cwd must not break them — if one asserts on exact directory listings, check it).

### Step 2: Implement `uninstallPlugin`

Create `src/uninstall.ts` exporting:

```ts
export interface UninstallOptions {
  scope?: InstallScope;      // default "project"
  targets?: HarnessId[];     // default: all harnesses in the manifest entry
  dryRun?: boolean;
}
export interface RemovedItem { harness: HarnessId; kind: string; name: string; files: string[]; note?: string; }
export function uninstallPlugin(pluginId: string, options?: UninstallOptions): RemovedItem[];
```

Behavior, per manifest item (filtered by `targets` when given):

- `skill` / `command` / `subagent` / `file`: delete each recorded path **iff it
  still exists**; after deleting skill files, remove the skill directory if now
  empty (use `rmSync` on files, `rmdirSync` best-effort on the dir). Never
  glob; only recorded paths.
- `context`: read the file; remove the
  `<!-- agent-plugin-sdk:<id> START -->…<!-- agent-plugin-sdk:<id> END -->`
  block (reuse/extract the regex from `mergeMarkdownBlock` — export a helper
  from `install.ts` rather than duplicating the escape logic); write back. If
  the file is then empty/whitespace, leave the empty file (deleting a shared
  `CLAUDE.md` is riskier than leaving it).
- `mcp`: parse the JSON config; delete only the server names in `detail` from
  the merge key; write back preserving everything else. Invalid JSON → skip
  with a note (never throw mid-uninstall; collect notes).
- `hook`: parse the JSON config; remove exactly the groups recorded in
  `detail` (match by `JSON.stringify` equality, mirroring `mergeHooksInto`'s
  dedupe); write back.
- After processing, remove the plugin's entry from the manifest (or the whole
  manifest file if it becomes empty). In `dryRun`, delete nothing, return what
  would be removed.
- No manifest / no entry for the id → throw an `Error` with a clear message
  (the CLI turns it into `fail()`).

**Verify**: `pnpm turbo typecheck --filter=@jalco/ap-sdk` → exit 0.

### Step 3: Wire the CLI

In `src/cli.ts`:

1. HELP: `ap-sdk uninstall <plugin-id> [options]   Remove a previously installed plugin from local harness dirs`,
   with `--global`, `--target`, `--dry-run` noted as applying, and an example.
2. Dispatch: `uninstall` needs no plugin module — only the id string. Handle it
   in the pre-resolution group (like `add-harness`/`port`): the second
   positional is the **plugin id**, not a path. Call `uninstallPlugin`, print a
   report symmetrical to `runInstall`'s (✓ per removed item, `(skipped)` +
   dim note for skips, `Would remove` under `--dry-run`).

**Verify**: build the package (`pnpm turbo build --filter=@jalco/ap-sdk`), then
in a temp dir: install the example plugin
(`node <repo>/packages/agent-plugin-sdk/dist/cli.js install <repo>/packages/agent-plugin-sdk/examples/git-helper/plugin.ts -t claude`),
confirm `.claude/` and `.ap-sdk/install-manifest.json` exist, then
`node .../cli.js uninstall git-helper` → recorded files gone, manifest entry
gone, exit 0.

### Step 4: Tests

Create `test/uninstall.test.ts` (temp-dir pattern from
`test/install.test.ts:28-37`). Cases:

1. install → uninstall round-trip for a plugin with a skill + command
   (claude target): files exist after install, gone after uninstall, skill dir
   removed, manifest entry removed.
2. Context block: pre-seed a `CLAUDE.md` with user content, install a plugin
   with `instructions`, uninstall → user content intact, marker block gone.
3. MCP merge: pre-seed `opencode.json` with an existing server (copy the
   fixture from `test/install.test.ts`), install plugin with a server,
   uninstall → plugin's server gone, pre-existing server and other keys intact.
4. Hooks: install a plugin with one hook into a config that already has a
   foreign hook group; uninstall → only the plugin's group removed.
5. `dryRun: true` removes nothing but reports the paths.
6. Unknown plugin id → throws with a message containing the id.
7. Recorded file already deleted by the user → uninstall does not throw;
   reports it skipped.

**Verify**: `pnpm turbo test --filter=@jalco/ap-sdk` → all pass, including 7
new tests.

### Step 5: Docs + changelog

- `apps/docs/content/docs/installing-plugins.mdx`: add an "Uninstalling"
  section — command, `--dry-run`, the manifest location, and the limitation
  (installs made before this SDK version have no manifest and can't be
  auto-removed).
- `.tegami/2026-07-01-uninstall.md`:
  ```md
  ---
  packages:
    "@jalco/ap-sdk": minor
  ---

  ## Add `ap-sdk uninstall`

  `install` now records what it wrote to an install manifest
  (`.ap-sdk/install-manifest.json`), and `ap-sdk uninstall <plugin-id>` cleanly
  reverses it — deleting the plugin's files and removing only its entries from
  merged configs (instruction blocks, MCP servers, hooks).
  ```

**Verify**: `pnpm turbo typecheck test lint build` → all tasks pass.

## Test plan

See Step 4 — seven cases listed there, modeled on `test/install.test.ts`. The
merge-reversal cases (2–4) are the risk-bearing ones; they assert *preservation
of foreign content*, not just removal.

## Done criteria

- [ ] `install` (non-dry-run) writes/updates the manifest; dry-run does not
- [ ] `uninstall` removes only recorded files/entries; foreign content in shared configs survives (tests 2–4)
- [ ] `node dist/cli.js --help | grep uninstall` → present
- [ ] Round-trip smoke test in Step 3 passes
- [ ] 7 new tests pass; full suite green
- [ ] `.tegami/2026-07-01-uninstall.md` exists with `minor` bump
- [ ] `pnpm turbo typecheck test lint build` exits 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `install.ts`'s merge functions don't match the excerpts (drifted).
- Reversing the hook merge requires information `mergeHooksInto` doesn't have
  at install time — report the design gap rather than guessing group identity.
- You're tempted to delete a directory not created from recorded paths (e.g.
  "clean up `.claude/skills` if empty" beyond the plugin's own skill dirs) —
  that's how user data gets destroyed; recorded paths only.
- Existing install tests fail because of the manifest write and the fix isn't
  a test-fixture adjustment.

## Maintenance notes

- Every new `kind` added to `InstalledItem` in the future MUST get an uninstall
  branch and a round-trip test — reviewers should reject install-feature PRs
  that skip it.
- Manifest `version: 1` exists so the shape can evolve; bump it on any breaking
  shape change and keep a reader for v1.
- Deferred: uninstalling pre-manifest installs (heuristic cleanup) and
  `ap-sdk list` (print installed plugins from the manifest) — the latter is a
  natural, cheap follow-up.
