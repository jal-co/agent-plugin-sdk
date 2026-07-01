# Contributing

Thanks for helping improve **ap-sdk** — write an agent plugin once, ship it to
every harness. This guide covers local setup, conventions, adding a harness, and
the release flow. For agent-facing rules, see [`AGENTS.md`](./AGENTS.md).

## Project layout

A pnpm + Turborepo monorepo:

| Path | Package | Notes |
| --- | --- | --- |
| `packages/agent-plugin-sdk/` | `@jalco/ap-sdk` | the SDK + `ap-sdk` CLI (published) |
| `apps/docs/` | `@jal-co/docs` | the docs site (private) |
| `scripts/tegami.mts` | — | release configuration |

The npm package is `@jalco/ap-sdk`; the CLI binary is `ap-sdk`. The project,
brand, and GitHub repo are `agent-plugin-sdk` (org `jal-co`).

## Local setup

Requires **Node 24+** and **pnpm** (the repo pins a version via `packageManager`).

```bash
pnpm install
pnpm turbo build
```

Useful commands:

```bash
pnpm --filter @jalco/ap-sdk test         # run the SDK tests
pnpm --filter @jalco/ap-sdk test:watch   # watch mode
pnpm --filter @jal-co/docs dev           # docs site at localhost:3000
node packages/agent-plugin-sdk/dist/cli.js --help   # the built CLI
```

## The verify gate

Before every commit, this must pass:

```bash
pnpm turbo typecheck test lint build
```

Never mark work done with failing tests, a partial implementation, or unresolved
errors. CI runs the same gate on every push and pull request.

## Commits & branches

Both are enforced locally (husky hooks) and in CI (the commit-check action):

- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/):
  `type(scope): summary` — e.g. `feat(gemini): add command translation`,
  `fix: handle null tool result`. A `!` or `BREAKING CHANGE:` footer signals a
  breaking change. Subject ≤ 80 chars, imperative, lowercase after the colon.
- **Branches** follow [Conventional Branch](https://conventional-branch.github.io/):
  `type/short-description` — e.g. `feat/add-acme-harness`, `fix/install-paths`.
- Never commit directly to `main`. Branch → verify → open a PR.

## Adding a harness

A harness is one target agent. The full guide —
the capability map, native `emit`, and install paths — is in the docs:
**[Authoring a harness](https://ap-sdk.dev/docs/authoring-a-harness)**. In short:

1. **Scaffold** a working starter:
   ```bash
   node packages/agent-plugin-sdk/dist/cli.js add-harness acme --name "Acme Agent"
   ```
   (or `npx ap-sdk add-harness …`). Put built-in harnesses in
   `packages/agent-plugin-sdk/src/harnesses/`.
2. **Declare `supports`** — the capability map is the single source of truth.
   Anything left `false` degrades to a structured warning, never a broken file.
3. **Implement `emit`** as a pure translator using the shared emit helpers, and
   point the **install paths** at the agent's real directories.
4. **Research the native format first** — confirm each harness's real paths and
   frontmatter against its official docs. Never guess; fail loudly if unsure.
5. **Register it.** For a built-in, add it to `harnesses/index.ts`; the support
   matrix, CLI, and docs pick it up automatically.
6. **Add tests** asserting the emitted paths and frontmatter (mirror an existing
   harness's test), and run the verify gate.

## Changelogs & releases

Releases run through [Tegami](https://tegami.fuma-nama.dev). Any user-facing
change to `@jalco/ap-sdk` ships with a changelog file under `.tegami/`:

```md
---
packages:
  "@jalco/ap-sdk": minor
---

## Short, user-facing title

What changed and why.
```

- Bump type follows SemVer: a feature is `minor`, a fix is `patch`, a breaking
  change is `major` (see `AGENTS.md` for the exact criteria).
- Heading depth can set the bump (`#` major, `##` minor, `###` patch).
- Don't hand-edit `package.json` versions, the publish lock, or `CHANGELOG.md` —
  Tegami owns them. On merge to `main`, CI opens a **Version Packages** PR;
  merging that publishes to npm and cuts the GitHub release.

## Pull requests

- Open as a **draft** while in progress; mark ready once the verify gate passes.
- Keep PRs focused and under ~400 lines where reasonable; don't bundle unrelated
  changes. Include a short **what / why / how / testing**, and **screenshots**
  for any docs-site UI change.
- Feature branches **squash merge**; delete the branch after merge.
- Resolve all conflicts before review; don't self-approve.

## Reporting issues

Open a GitHub issue with a minimal repro (a small `plugin.ts` and the command
you ran) and the actual vs. expected output. Security concerns: please report
privately rather than in a public issue.
