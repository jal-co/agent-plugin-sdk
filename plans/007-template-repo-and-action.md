# Plan 007: Design the distribution story — plugin template repo + GitHub Action (spike)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fe6fb92..HEAD -- packages/agent-plugin-sdk/src/github.ts packages/agent-plugin-sdk/src/cli.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M (this spike: S–M; the follow-on build: M)
- **Risk**: LOW (spike is design + one in-repo example; external repos are a follow-up)
- **Depends on**: 002 (`ap-sdk init` — the template repo should be what `init` produces, kept in sync)
- **Category**: direction
- **Planned at**: commit `fe6fb92`, 2026-07-01

## Why this matters

The SDK can already **consume** plugins from GitHub — `ap-sdk install owner/repo`
fetches a tarball, locates the plugin, and runs a compatibility check
(`src/github.ts`). But there is no **producing** counterpart: no template repo a
new author can click "Use this template" on, and no CI recipe that builds and
validates a plugin repo on push. Every published plugin repo is marketing (a
badge, a README pointing back at ap-sdk); making publishing a 5-minute act
multiplies that. This is a *spike/design plan*: it produces a validated design
doc and an in-repo reference example — not the external repos themselves, which
need operator decisions (repo names, org settings) and can't be verified from
this codebase.

## Current state

- `packages/agent-plugin-sdk/src/github.ts` — `parseGithubSpec` accepts
  `owner/repo`, `owner/repo#ref`, `github:owner/repo`, and github.com URLs
  (line ~30); `fetchGithubPlugin` downloads a tarball to a temp dir and locates
  the plugin via `locatePlugin` / `DEFAULT_PLUGIN_FILES` (`plugin.ts`,
  `plugin.js`, `ap-sdk.config.ts` — confirm in `src/plugin-files.ts`), with
  `--path` for plugins in a subdirectory.
- `src/cli.ts` — `ap-sdk check <github-spec>` already prints a compatibility
  report for a remote repo (`printCompatibility`, ~line 280): plugin id +
  counts of skills/commands/subagents/hooks/MCP servers. **This is the exact
  check a plugin repo's CI should run on itself** (locally, as
  `ap-sdk check` on the working tree).
- `ap-sdk build` exits non-zero only on validation errors; capability gaps are
  warnings. So a CI gate is: `check` (validity) + `build` (artifacts) and
  optionally failing on warnings — note that `build` currently has **no
  `--fail-on-warnings` flag** (verify in `cli.ts`; the spike should decide
  whether to propose one).
- This repo's own CI: `.github/workflows/ci.yml` (turbo gate),
  `commit-check.yml`, `publish.yml` + Tegami workflows — read `ci.yml` for the
  style (pnpm setup, turbo filters) the example workflow should match.
- Existing example plugins: `packages/agent-plugin-sdk/examples/{echo-tool,git-helper,planreview}` —
  `git-helper` is the canonical demo (skill with resources, commands, subagent).
- Plan 002 defines the scaffold content (`pluginTemplate`); the template repo
  must not fork away from it.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install deps | `pnpm install` | exit 0 |
| Validate example plugin | `cd packages/agent-plugin-sdk && pnpm cli check examples/git-helper/plugin.ts` | `is valid` |
| Remote-install smoke (read-only) | `pnpm cli check https://github.com/jal-co/agent-plugin-sdk --path packages/agent-plugin-sdk/examples/git-helper` | compatibility report |
| Full gate | `pnpm turbo typecheck test lint build` | all tasks pass |

## Scope

**In scope** (the only files you should modify/create):

- `plans/007-artifacts/design.md` (create — the design doc; this plan's main deliverable)
- `plans/007-artifacts/template/` (create — the complete file set for the future template repo, as a reference tree: `plugin.ts`, `package.json`, `README.md`, `.github/workflows/validate.yml`, `.gitignore`)
- `plans/007-artifacts/action.yml` (create — draft composite-action definition)

**Out of scope** (do NOT touch / do NOT do):

- Creating any GitHub repo, org setting, or marketplace listing — operator
  actions, listed as next steps in the design doc.
- Changes to `packages/agent-plugin-sdk/src/**` — if the spike concludes a CLI
  flag is needed (e.g. `--fail-on-warnings`), it goes in the design doc as a
  proposed follow-up plan, not into code now.
- `apps/docs/**` — a "Publish your plugin" docs page is a follow-up once the
  repos exist.

## Git workflow

- Branch: `docs/distribution-spike`
- Commit style: `docs: distribution design spike (template repo + action)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Validate the consumption path end-to-end

Run the two smoke commands from "Commands you will need" (local `check` of
`examples/git-helper`, and the remote `check` against this very repo with
`--path`). Record exact outputs in `design.md` — they prove the install-side
works and give the template README real output to show.

**Verify**: both commands print a compatibility verdict; remote one shows
`is a compatible ap-sdk plugin`.

### Step 2: Build the reference template tree

Under `plans/007-artifacts/template/`, create the complete file set:

- `plugin.ts` — exactly plan 002's scaffold output (or
  `examples/git-helper/plugin.ts` content if 002 hasn't landed; note which).
- `package.json` — private, `devDependencies: { "@jalco/ap-sdk": "^0.3.0" }`,
  scripts: `check`, `build`, `install-local` mapping to `ap-sdk check|build|install`.
- `.github/workflows/validate.yml` — checkout, setup pnpm + node, `pnpm install`,
  `pnpm check`, `pnpm build`, upload `.aps-out/` as an artifact. Match the
  syntax/style of this repo's `.github/workflows/ci.yml`.
- `README.md` — "Use this template" instructions, the
  `npx ap-sdk install <owner>/<repo>` one-liner consumers will run, and an
  ap-sdk attribution badge/link.
- `.gitignore` — `.aps-out/`, `node_modules/`.

**Verify**: `cd packages/agent-plugin-sdk && pnpm cli check <abs-path>/plans/007-artifacts/template/plugin.ts` → `is valid`.

### Step 3: Draft the composite action

Write `plans/007-artifacts/action.yml`: a composite GitHub Action
(`runs.using: composite`) with inputs `plugin-path` (default `.`), `targets`
(default all), `fail-on-warnings` (default `false`), that runs
`npx -y @jalco/ap-sdk check` and `build` and uploads artifacts. Where a step
can't be expressed without a new CLI flag (warnings gate), mark it clearly:
`# BLOCKED-ON: ap-sdk build --fail-on-warnings (proposed)`.

**Verify**: `node -e "require('yaml').parse(require('fs').readFileSync('plans/007-artifacts/action.yml','utf8'))"`
(run from `packages/agent-plugin-sdk` so the `yaml` dep resolves) → no throw.

### Step 4: Write the design doc

`plans/007-artifacts/design.md` covering:

1. **Goal & audience** — plugin authors publishing to GitHub; consumers using
   `ap-sdk install owner/repo`.
2. **Deliverables** — (a) `jal-co/ap-sdk-plugin-template` repo (content =
   Step 2 tree), (b) `jal-co/ap-sdk-action` (content = Step 3), (c) a
   `/docs/publishing` page. For each: exact repo settings needed ("template
   repository" checkbox, topics for discoverability).
3. **Sync strategy** — how the template repo stays aligned with `ap-sdk init`
   (recommendation: template repo content is generated from the same
   `pluginTemplate()` source; a CI job in this monorepo diff-checks it).
4. **Proposed CLI follow-ups** — `--fail-on-warnings` on `build`; anything else
   the spike surfaced. Each with a one-line rationale, sized S/M.
5. **Open questions for the operator** — repo names, whether the action goes to
   the GitHub Marketplace, versioning of the action (`v1` tag convention).
6. The Step 1 transcripts.

**Verify**: `design.md` contains all six sections
(`grep -c "^## " plans/007-artifacts/design.md` → ≥ 6).

### Step 5: Gate

**Verify**: `pnpm turbo typecheck test lint build` → all tasks pass (nothing in
`plans/` is built, but run the gate to confirm the working tree is clean of
accidental edits).

## Test plan

Spike — no unit tests. The verifications are: template `plugin.ts` passes
`check` (Step 2), `action.yml` parses (Step 3), remote `check` transcript
recorded (Step 1).

## Done criteria

- [ ] `plans/007-artifacts/design.md` exists with the six sections
- [ ] `plans/007-artifacts/template/` passes `ap-sdk check` and contains the five listed files
- [ ] `plans/007-artifacts/action.yml` parses as YAML; blocked steps marked `BLOCKED-ON`
- [ ] Step 1 transcripts embedded in the design doc
- [ ] No files outside `plans/` modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The remote `check` against this repo fails (the consumption path is broken —
  that's a bug finding, bigger than this spike).
- You find yourself editing `src/` to add the warnings flag — that's a
  follow-up plan, not this one.
- GitHub-side actions (creating repos) seem necessary to "finish" — they are
  operator steps by design; the spike ends at the design doc.

## Maintenance notes

- The follow-up implementation plan (create the repos, publish the action,
  write `/docs/publishing`) should be written after the operator answers the
  design doc's open questions — add it as a new plan then.
- If plan 002 lands after this spike, regenerate `template/plugin.ts` from
  `pluginTemplate()` so they don't drift.
- Reviewer: judge the design doc by whether the operator can execute it without
  asking anything about the SDK's behavior.
