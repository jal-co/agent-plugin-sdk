# Handoff — agent-plugin-sdk

This document is the single source of truth for picking up work on this repo. It
captures the current state, the architecture, the conventions, and every
remaining task. Read it top to bottom before starting.

> **Context:** This project was originally created by Sahaj Jain
> ([@jnsahaj](https://github.com/jnsahaj)) and is continued here at
> `jal-co/agent-plugin-sdk` with permission (a clean continuation, **not** a
> fork). Attribution lives in the README, the root LICENSE, and the SDK
> `package.json`.

---

## 1. What this project is

`@jal-co/agent-plugin-sdk` lets you define an agent plugin **once** in TypeScript
and compile it to the **native installable artifacts** each coding-agent harness
expects — no runtime, no wrapper. The output is exactly the files those harnesses
load on their own.

The design mirrors the [ai-sdk](https://ai-sdk.dev) "portable core + provider"
split:

- **Portable definition layer** — `definePlugin`, `defineSkill`, `defineCommand`,
  `defineSubagent`, `defineHook`, `defineTool`.
- **Capability map + structured warnings** — each harness declares which portable
  features it `supports`; a feature a target can't represent becomes a
  `BuildWarning` (never a throw, never a silently-wrong file).
- **Per-harness emitters** — pure portable→native translators.

---

## 2. Current state (done)

All of the following is **merged to `main`**, linear history, conventional
commits. The whole pipeline is green: `pnpm turbo typecheck test build lint`.

| Area | Status |
|---|---|
| Original codebase imported (non-fork, history preserved) | ✅ |
| Turborepo monorepo (pnpm workspaces + turbo) | ✅ |
| SDK renamed to `@jal-co/agent-plugin-sdk` under `packages/` | ✅ |
| Fumadocs docs app scaffolded at `apps/docs` (`@jal-co/docs`) | ✅ (scaffold only — content TODO) |
| shadcn/ui wired into the docs app (Tailwind v4, Biome) | ✅ |
| Provider extensibility: `registerHarness` registry, `/harness` toolkit, `add-harness` CLI | ✅ |
| **8 harnesses**: claude, codex, pi, opencode, gemini, copilot, cursor, windsurf | ✅ |
| CI (`.github/workflows/ci.yml`), commit-check, husky hooks, `commit-check.toml` | ✅ |
| Minimal shieldcn-style README | ✅ |
| Tests: **101 passing** | ✅ |
| Paper MCP wired into Pi (`~/.pi/agent/mcp.json`) | ✅ (restart Pi to activate) |

### Repo layout

```
agent-plugin-sdk/                 # private monorepo root (turbo + pnpm)
├─ packages/agent-plugin-sdk/     # @jal-co/agent-plugin-sdk (the SDK)
│  ├─ src/
│  │  ├─ index.ts                 # public entrypoint
│  │  ├─ harness.ts               # ./harness authoring entrypoint (for custom harnesses)
│  │  ├─ runtime/                 # ./runtime entrypoint (defineTool + adapters)
│  │  ├─ define.ts validate.ts build.ts emit.ts install.ts warnings.ts
│  │  ├─ scaffold.ts              # add-harness template generator
│  │  ├─ cli.ts                   # `agent-plugin` CLI
│  │  └─ harnesses/               # one file per harness + shared.ts, hooks.ts, mcp.ts, tools.ts
│  ├─ test/                       # vitest (one suite per harness + core)
│  └─ examples/                   # git-helper, echo-tool, planreview
└─ apps/docs/                     # @jal-co/docs (Next.js 16 + Fumadocs + shadcn)
```

### The 8 harnesses (verified support matrix)

Generated from each harness's `supports` map (see `supportMatrix()`):

| feature | claude | codex | pi | opencode | gemini | copilot | cursor | windsurf |
|---|---|---|---|---|---|---|---|---|
| instructions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| skills | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| commands | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| subagents | ✅ | ✅ | — | ✅ | ✅ | ✅ | — | — |
| hooks | ✅ | ✅ | — | — | ✅ | ✅ | — | — |
| mcpServers | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| tools | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Each new harness was researched against official docs before implementation. Key
native formats (for reference when editing):

- **Gemini** — `gemini-extension.json` manifest; TOML commands (`$ARGUMENTS`→`{{args}}`,
  positional args warn); `.gemini/agents/*.md`; `hooks/hooks.json` (ms timeouts);
  MCP in manifest (`httpUrl` for remote).
- **Copilot** — `.github/copilot-instructions.md`; `.github/skills/*/SKILL.md`;
  `.github/prompts/*.prompt.md`; `.github/agents/*.agent.md`; `.github/copilot/hooks.json`
  (PascalCase events, no matcher → warn); `.vscode/mcp.json` (`servers`, `type` discriminator).
- **Cursor** — `AGENTS.md`; `.cursor/commands/*.md`; `.cursor/mcp.json` (`mcpServers`).
  No SKILL.md, no subagents, hooks don't map → warnings.
- **Windsurf** — `AGENTS.md`; `.windsurf/skills/*/SKILL.md`; `.windsurf/workflows/*.md`;
  `mcp_config.json` (`mcpServers`, remote uses `serverUrl`). Global-only MCP. No subagents/hooks.

---

## 3. Conventions (follow these)

- **Branching** ([Conventional Branch](https://conventional-branch.github.io/)):
  `feat/…`, `fix/…`, `docs/…`, `ci/…`, `refactor/…`, etc. Never commit directly to `main`.
- **Commits** ([Conventional Commits](https://www.conventionalcommits.org/)):
  enforced by husky `commit-msg` + `commit-check` in CI. Subject ≤ 80 chars.
- **Workflow used so far:** branch → implement → `pnpm turbo typecheck test build lint`
  green → commit → `git checkout main && git merge --ff-only <branch>` → delete branch.
  History is kept linear (fast-forward), not squashed, because each commit is already clean.
- **Verify before every commit:** `pnpm turbo typecheck test build lint` (all must pass).
- **Package manager:** pnpm 10. `onlyBuiltDependencies` in root `package.json` allows
  `esbuild` + `sharp` build scripts.

---

## 4. Remaining work

Ordered by priority. Each is a separate branch/PR.

### 4.1 Website build-out (the big one) — `feat/docs-site`

The docs app at `apps/docs` is a working Fumadocs + shadcn scaffold with **only a
placeholder `content/docs/index.mdx`**. It needs real content and a landing page.

**Open scope decisions (confirm with the user before writing):**
- **Docs depth** — full reference (~15-20 pages) vs. core set (~10 pages:
  getting-started + concepts + a page per feature + harnesses overview) vs.
  full-IA-with-stubs. Recommendation discussed: **core now**, stub the rest.
- **Landing page** — replace the placeholder home with a real hero (tagline,
  install, code sample, support matrix, CTA). Recommendation: **yes**.
- **Live support matrix** — generate the feature×harness table from the SDK's
  `supportMatrix()` at build time so docs never drift from code. Recommendation:
  **yes** — import `@jal-co/agent-plugin-sdk` into the docs app and render the table.
- **Deploy** — add Vercel monorepo config (root dir `apps/docs`, build via turbo);
  do **not** deploy (user connects when ready). Optional: custom-domain notes.

**Proposed information architecture (core set):**
```
content/docs/
├─ index.mdx                     # what it is + why
├─ installation.mdx
├─ quickstart.mdx
├─ concepts/
│  ├─ how-it-works.mdx           # common denominator + bespoke + warnings model
│  └─ support-matrix.mdx         # the live table
├─ features/
│  ├─ skills.mdx commands.mdx subagents.mdx hooks.mdx
│  ├─ mcp-servers.mdx instructions.mdx tools.mdx
├─ harnesses/index.mdx           # overview + per-harness native-format notes
├─ authoring-a-harness.mdx       # registerHarness + /harness toolkit + add-harness
└─ reference/cli.mdx             # (api.mdx as a follow-up)
```
Fumadocs needs a `meta.json` per folder for sidebar ordering. Content can be
pulled accurately from `src/types.ts` JSDoc and the harness implementations.

**Verify:** `pnpm --filter @jal-co/docs build` builds all routes;
`pnpm --filter @jal-co/docs lint` is clean (Biome with `tailwindDirectives` + `vcs.root: "../.."`).

### 4.2 Per-harness deep-dive docs — `docs/harness-reference`
One page per harness documenting its exact native artifact paths, frontmatter
fields, install locations, and capability gaps. Source of truth: the harness `.ts`
files and the per-harness test suites (`test/<harness>.test.ts`).

### 4.3 API reference — `docs/api-reference`
Document the public surface from `src/index.ts`, `src/harness.ts`, `src/runtime/index.ts`:
`build`, `installSkills`, `emitFor`, `supportMatrix`, `registerHarness`, `validatePlugin`,
`PluginValidationError`, all `define*` helpers, and the exported types. Consider
generating from JSDoc (typedoc) vs. hand-writing.

### 4.4 Publish readiness — `chore/release-setup`
The SDK is `0.1.0`, `publishConfig.access: public`, scoped `@jal-co`. To publish:
- Add [Changesets](https://github.com/changesets/changesets) for versioning +
  changelog (monorepo-aware). Add a `release` GitHub workflow (build → `changeset publish`).
- Decide initial public version (0.1.0 vs 0.2.0 given the 4 new harnesses).
- Confirm `files`/`exports` (`.`, `./runtime`, `./harness`) and that `dist` is built
  on publish (`prepublishOnly` or CI). `bin` is `agent-plugin`.
- npm provenance + `NPM_TOKEN` secret.

### 4.5 SDK linting (optional) — `chore/sdk-biome`
The SDK package has **no linter** (only `tsc`). The docs app uses Biome. For
consistency, consider adding Biome to the SDK too (will produce a formatting diff;
the code is already consistent, so mostly locks in style). Not required — `tsc` is
the current gate.

### 4.6 Paper-MCP design workflow (optional/exploratory)
The Paper MCP is now available in Pi (restart to activate). Possible use: design
the landing page / docs hero visually in Paper, then use `get_jsx` to pull
JSX/Tailwind into `apps/docs`. Not a blocker — a nice-to-have for the website work.

---

## 5. Gotchas / things to know

- **Install relocation finders** (`src/install.ts`) were generalized so harnesses
  emitting at non-bundle paths (`.github/skills/`, `.windsurf/`) or non-`.md`
  command extensions (`.toml`, `.prompt.md`) relocate correctly. Skills match by
  the `skills/<name>/` path segment; commands/subagents match by the install-target
  basename. Keep this in mind if adding a 9th harness — there are tests for it in
  `test/install.test.ts`.
- **`HarnessId` is an open union** (`BuiltinHarnessId | (string & {})`) so external
  harnesses keep autocomplete for built-ins while accepting any id.
- **Adding a harness internally:** implement `src/harnesses/<id>.ts`, add it to the
  `builtins` array + `BuiltinHarnessId` union, add a `test/<id>.test.ts`, and update
  the cross-harness lists in `test/skills.test.ts`, `test/registry.test.ts`,
  `test/warnings.test.ts`, and `test/example.test.ts`.
- **Adding a harness externally:** `agent-plugin add-harness <id>` scaffolds a
  self-registering stub against `@jal-co/agent-plugin-sdk/harness`.
- **CLI output dir:** `agent-plugin build -o <dir>` joins the dir to cwd (it does
  not treat an absolute `/tmp/...` as absolute — uses `path.join`).
- **Biome in the docs app** requires `vcs.root: "../.."` (root `.gitignore`) and
  `css.parser.tailwindDirectives: true` (for `@theme`/`@custom-variant`).

---

## 6. Quick commands

```bash
pnpm install                              # bootstrap the workspace
pnpm turbo typecheck test build lint      # the full gate (run before every commit)
pnpm --filter @jal-co/agent-plugin-sdk test
pnpm --filter @jal-co/docs dev            # docs site at localhost:3000
node packages/agent-plugin-sdk/dist/cli.js build examples/planreview/plugin.ts -t gemini -o /tmp/out
```
