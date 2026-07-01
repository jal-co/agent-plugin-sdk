# Plan 002: Add an `ap-sdk init` command that scaffolds a new plugin project

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fe6fb92..HEAD -- packages/agent-plugin-sdk/src packages/agent-plugin-sdk/test apps/docs/content/docs/quickstart.mdx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `fe6fb92`, 2026-07-01

## Why this matters

The quickstart currently tells a new user to hand-write `plugin.ts` from a code
sample. That's friction at the exact moment a visitor decides whether to try the
tool. The CLI already has a scaffolding precedent — `ap-sdk add-harness`
generates a working harness module from a template (`src/scaffold.ts`) — but
there is no equivalent for the far more common case: starting a new plugin.
`ap-sdk init` (and therefore `pnpm create` / `npx ap-sdk init`) turns "read the
docs, copy a block, fix imports" into one command that produces a working,
`check`-clean plugin.

## Current state

- `packages/agent-plugin-sdk/src/cli.ts` — the CLI. The `HELP` string
  (lines 24–70) lists commands: `build`, `install`, `check`, `tools`,
  `add-harness`, `port`. Command dispatch is in `main()`:
  ```ts
  // cli.ts (~line 218)
  if (args.command === "add-harness") {
    runAddHarness(args);
    return;
  }
  // `port` reads an existing plugin directory ...
  if (args.command === "port") {
    runPort(args);
    return;
  }
  ```
  Commands that need no plugin definition are dispatched *before*
  `enableTypeScript()` and plugin resolution. `init` belongs in this group.
- `packages/agent-plugin-sdk/src/scaffold.ts` — the existing scaffolding module
  for `add-harness`. Conventions to match:
  - a `KEBAB` regex `^[a-z0-9]+(-[a-z0-9]+)*$` and a `validateHarnessId`
    returning `string | null`;
  - a pure `harnessTemplate(id, displayName, pkg = "@jalco/ap-sdk"): string`
    function that returns the full file content;
  - the generated file "compiles as-is and produces real (if minimal)
    artifacts" — the template is a *working* starter, not a stub of TODOs.
- `runAddHarness` in `cli.ts` (~line 440) shows the output conventions: refuse
  to overwrite an existing file (`fail(\`Refusing to overwrite existing file: ...\`)`),
  support `--dry-run` (print content instead of writing), print `Next steps`
  with `dim()` styled commands.
- `packages/agent-plugin-sdk/src/plugin-files.ts` exports
  `DEFAULT_PLUGIN_FILES` (the filenames `locatePlugin` searches: `plugin.ts`,
  `plugin.js`, `ap-sdk.config.ts` — read the file to confirm exact list).
- The canonical starter plugin shape (use this as the template's content —
  it is the same example the docs use), from
  `apps/docs/content/docs/quickstart.mdx`:
  ```ts
  import { definePlugin, defineSkill, defineCommand } from "@jalco/ap-sdk";

  export default definePlugin({
    id: "git-helper",
    description: "Helpers for working with git in a repo.",
    instructions: "## Git\n- Branch off main; never commit to it directly.",
    skills: [
      defineSkill({
        name: "diff-review",
        description:
          "Summarize and risk-flag uncommitted changes. Use when the user asks what changed.",
        instructions: "Run `git diff HEAD` and summarize the changes in 2-4 bullets.",
      }),
    ],
    commands: [
      defineCommand({
        name: "commit",
        description: "Write a conventional commit for the staged changes.",
        body: "Write a Conventional Commit message for the staged diff. Args: $ARGUMENTS",
      }),
    ],
  });
  ```
- Test conventions: vitest, files under `packages/agent-plugin-sdk/test/*.test.ts`.
  Tests that touch the filesystem use `mkdtempSync(join(tmpdir(), "aps-..."))` +
  `process.chdir` in `beforeEach`/`afterEach` — see `test/install.test.ts:28-37`
  for the exact pattern. There is currently no test that shells out to the CLI;
  test the scaffold function directly (like the existing `add-harness` scaffold
  is testable via `harnessTemplate`).
- Repo AGENTS.md: every user-facing SDK change ships with a `.tegami/` changelog;
  a new CLI command is a **minor** bump.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install deps | `pnpm install` | exit 0 |
| SDK tests | `pnpm turbo test --filter=@jalco/ap-sdk` | all pass |
| Typecheck | `pnpm turbo typecheck --filter=@jalco/ap-sdk` | exit 0 |
| Full gate | `pnpm turbo typecheck test lint build` | all tasks pass |
| Manual smoke | `cd $(mktemp -d) && node <repo>/packages/agent-plugin-sdk/dist/cli.js init my-plugin` (after build) | files written, exit 0 |

## Scope

**In scope** (the only files you should modify/create):

- `packages/agent-plugin-sdk/src/cli.ts` — HELP text, arg parsing (if needed), `runInit`
- `packages/agent-plugin-sdk/src/scaffold-plugin.ts` (create — the template module; keep `scaffold.ts` for harnesses)
- `packages/agent-plugin-sdk/test/init.test.ts` (create)
- `apps/docs/content/docs/quickstart.mdx` — lead with `npx ap-sdk init` before the hand-written option
- `.tegami/2026-07-01-init-command.md` (create)

**Out of scope** (do NOT touch):

- `src/scaffold.ts` — the harness scaffolder; don't refactor or merge it.
- `src/port.ts`, `src/github.ts` — unrelated.
- A separate `create-ap-sdk` npm package — explicitly deferred (see Maintenance
  notes).
- `package.json` `bin` — `init` rides the existing `ap-sdk` binary.

## Git workflow

- Branch: `feat/ap-sdk-init` (from `main`)
- Commit style: `feat(sdk): add ap-sdk init scaffold command` (conventional commits, scope `sdk` — matches `git log`, e.g. `feat(sdk): per-hook async flag and command frontmatter passthrough`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the plugin template module

Create `packages/agent-plugin-sdk/src/scaffold-plugin.ts` exporting:

- `validatePluginId(id: string): string | null` — same kebab-case rule and
  error-message style as `validateHarnessId` in `src/scaffold.ts` (copy the
  regex; the `Plugin.id` doc in `src/types.ts` specifies
  `^[a-z0-9]+(-[a-z0-9]+)*$`).
- `pluginTemplate(id: string, pkg = "@jalco/ap-sdk"): string` — returns the
  full `plugin.ts` content: the canonical starter from "Current state" with
  `id` substituted for `"git-helper"` and a short header comment pointing at
  `https://ap-sdk.dev/docs/quickstart`. The description and skill/command
  content stay generic (keep the git-helper example content — it demonstrates
  a skill, a command, and instructions in ~30 lines and `check`s clean).
- `gitignoreSnippet(): string` — returns `".aps-out/\n"`.

Match the file-header JSDoc style of `src/scaffold.ts` (block comment explaining
what the module generates).

**Verify**: `pnpm turbo typecheck --filter=@jalco/ap-sdk` → exit 0.

### Step 2: Wire `init` into the CLI

In `packages/agent-plugin-sdk/src/cli.ts`:

1. Add to `HELP` under Usage (keep alignment style):
   `ap-sdk init    [id] [options]     Scaffold a new plugin.ts in the current directory`
   and an example: `ap-sdk init my-plugin`.
2. Dispatch before plugin resolution, next to `add-harness` and `port`:
   ```ts
   if (args.command === "init") {
     runInit(args);
     return;
   }
   ```
3. Implement `runInit(args: Args)` following `runAddHarness`'s conventions
   exactly:
   - `id` = `args.plugin` (second positional); default `"my-plugin"` when
     omitted; validate with `validatePluginId`, `fail(problem)` on error.
   - Target file: `resolve(process.cwd(), args.out ?? ".", "plugin.ts")`.
   - If the target exists → `fail("Refusing to overwrite existing file: " + target)`.
   - `--dry-run` → print `Would write` + the content, return without writing.
   - Otherwise write the file; if a `.gitignore` exists in the target dir and
     doesn't contain `.aps-out`, append the snippet; if none exists, create one
     containing only the snippet.
   - Print `Next steps` (match `runAddHarness`'s styling with `tick()`,
     `bold()`, `dim()`):
     `npx ap-sdk check` · `npx ap-sdk build` · `npx ap-sdk install -t <harness>`.

**Verify**: `pnpm turbo build --filter=@jalco/ap-sdk` → exit 0, then
`cd $(mktemp -d) && node <repo-abs-path>/packages/agent-plugin-sdk/dist/cli.js init demo && ls` →
`plugin.ts` and `.gitignore` present.

### Step 3: The generated plugin must pass `check`

In the same temp dir (the generated `plugin.ts` imports `@jalco/ap-sdk`, which
isn't installed there), verify via the repo instead: copy the generated
`plugin.ts` into a temp dir and run the check with the workspace CLI:

```bash
cd packages/agent-plugin-sdk && pnpm cli check <tempdir>/plugin.ts
```

(`pnpm cli` runs `tsx src/cli.ts` per `package.json` scripts. The import
`@jalco/ap-sdk` resolves because the workspace maps it.)

If module resolution fails in the temp dir, instead write the generated content
into `packages/agent-plugin-sdk/` as a temp file, check it, and delete it —
the requirement is only that the template content validates.

**Verify**: output contains `is valid` and lists `1 skill(s), 1 command(s)`.

### Step 4: Tests

Create `packages/agent-plugin-sdk/test/init.test.ts` covering:

1. `pluginTemplate("my-plugin")` contains `definePlugin`, `id: "my-plugin"`,
   and imports from `@jalco/ap-sdk`.
2. The template content, written to a temp file and imported via the test
   runner, default-exports an object that passes `validatePlugin` (import
   `validatePlugin` from `../src/validate.js`). If dynamic import of a temp
   `.ts` file is awkward under vitest, instead construct the equivalent plugin
   object inline and assert `pluginTemplate` output string-contains each field —
   but prefer the real validation path. Model the temp-dir setup on
   `test/install.test.ts:28-37`.
3. `validatePluginId` rejects `"My_Plugin"` and accepts `"my-plugin"`.

**Verify**: `pnpm turbo test --filter=@jalco/ap-sdk` → all pass including the
new file.

### Step 5: Update the quickstart

In `apps/docs/content/docs/quickstart.mdx`, change section "## 1. Define a
plugin" to offer the scaffold first:

```bash
npx ap-sdk init my-plugin
```

with one sentence ("scaffolds a working plugin.ts you can edit"), then keep the
existing hand-written example as the "or write it yourself" path. Don't
restructure the rest of the page.

**Verify**: `pnpm turbo build --filter=@jal-co/docs` → exit 0 (MDX compiles).

### Step 6: Changelog + gate

Create `.tegami/2026-07-01-init-command.md`:

```md
---
packages:
  "@jalco/ap-sdk": minor
---

## Add `ap-sdk init`

Scaffold a new plugin project with one command. `ap-sdk init my-plugin` writes
a working `plugin.ts` (a skill, a command, and instructions) that passes
`ap-sdk check` as-is, plus a `.gitignore` entry for `.aps-out/`.
```

**Verify**: `pnpm turbo typecheck test lint build` → all tasks pass.

## Test plan

- New file `test/init.test.ts` (Step 4): template content validity, kebab-case
  id validation (accept/reject), generated plugin passes `validatePlugin`.
- Pattern: `test/install.test.ts` for temp-dir handling; assertions with
  `expect(...).toContain(...)` / `.toThrow()` as in `test/validate.test.ts`.
- Verification: `pnpm turbo test --filter=@jalco/ap-sdk` → all pass.

## Done criteria

- [ ] `node dist/cli.js init demo` in an empty temp dir writes `plugin.ts` + `.gitignore`, exit 0
- [ ] Re-running it fails with `Refusing to overwrite` and exit 1
- [ ] `--dry-run` prints content, writes nothing
- [ ] Generated plugin passes `check` (Step 3)
- [ ] `ap-sdk --help` output includes `init` (`node dist/cli.js --help | grep init`)
- [ ] Quickstart leads with `npx ap-sdk init`
- [ ] `.tegami/2026-07-01-init-command.md` exists with `minor` bump
- [ ] `pnpm turbo typecheck test lint build` exits 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `cli.ts` dispatch no longer matches the excerpt (drifted).
- An `init` or `create` command already exists in `HELP`.
- Step 3's validation cannot be made to pass without changing `validate.ts`
  (the template content is wrong — report, don't loosen validation).
- You find yourself wanting to add interactive prompts (inquirer etc.) — out of
  scope; flags only.

## Maintenance notes

- A future `create-ap-sdk` package (`pnpm create ap-sdk`) should delegate to
  this command — deferred because it needs a separate publish pipeline.
- If plan 007 (template repo) lands, consider `ap-sdk init --from owner/repo`
  reusing `fetchGithubPlugin` from `src/github.ts` — deferred.
- Reviewer: confirm the template stays in sync with the quickstart example —
  they are intentionally identical.
