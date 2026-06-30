# AGENTS.md — ap-sdk

<context>
This monorepo publishes one package, `ap-sdk` (in `packages/agent-plugin-sdk/`),
plus a private docs site (`apps/docs/`, `@jal-co/docs`). Tooling is pnpm +
Turborepo. This file extends the global agent rules (Conventional Commits,
Conventional Branch, SemVer); it does not replace them. Rules here are additive
unless wrapped in `<project-override>`.
</context>

---

## 1. Layout

<context>

| Path | Package | Published? |
|---|---|---|
| `packages/agent-plugin-sdk/` | `ap-sdk` | yes — npm |
| `apps/docs/` | `@jal-co/docs` | no — private site |
| `scripts/tegami.mts` | release config | — |

The CLI binary is `ap-sdk`. The project/brand and GitHub repo remain
`agent-plugin-sdk`; only the npm package and CLI are named `ap-sdk`.

</context>

---

## 2. Verify Gate

<rules>

- Before every commit, `pnpm turbo typecheck test lint build` MUST pass.
- MUST NOT mark work done with failing tests, partial implementations, or
  unresolved errors.
- Branch → verify → `git merge --ff-only` into `main` → delete branch. History
  stays linear; MUST NOT commit directly to `main`.

</rules>

---

## 3. Versioning

<rules>

Follow [SemVer 2.0.0](https://semver.org/) — `MAJOR.MINOR.PATCH`. While `0.y.z`,
the public API is still stabilizing, but the bump rules below MUST still be
applied (feature → minor, fix → patch, break → minor pre-1.0 / major post-1.0).

| Bump | When (for `ap-sdk`) |
|---|---|
| `MAJOR` | Breaking public API change: a changed/removed export signature (`definePlugin`, `defineSkill`, `defineCommand`, `defineTool`, `defineHarness`, …), a change to emitted artifact shape or install paths that breaks existing plugins, removing/renaming a built-in harness id, or raising the minimum Node version. |
| `MINOR` | Backwards-compatible additions: a new harness, a new capability or `defineX` option, a new CLI command/flag, additional emitted output that does not alter existing files. |
| `PATCH` | Backwards-compatible fixes: corrected emit output, install-path bug fixes, validation/warning fixes, dependency patch bumps. |

- A breaking change MUST be signalled by a Conventional Commit `!` and/or a
  `BREAKING CHANGE:` footer, and MUST map to a `major` changelog entry.
- Pre-release versions MUST use a hyphen suffix (`1.0.0-rc.1`, `1.0.0-alpha.2`).
- MUST NOT mutate a released version; every release gets a new version.
- Docs-only (`apps/docs/`) changes do NOT require a changelog — the docs site is
  private and unpublished.

</rules>

---

## 4. Publishing Flow (Tegami)

<context>
Releases run through [Tegami](https://tegami.fuma-nama.dev) — a Changesets-style
tool. Pending changelogs live in `.tegami/`; CI versions and publishes.
Authentication is npm **trusted publishing (OIDC)** — there is no `NPM_TOKEN`.
</context>

<workflow>

1. **Write a changelog** for any change to `ap-sdk`:
   - `pnpm tegami` — draft interactively or from conventional commits, or
   - hand-write a file under `.tegami/` (see §5).
2. **Commit** the changelog with your change and open a PR.
   - The **Tegami PR** workflow comments a release preview (pending bumps).
3. **Merge to `main`.** The **Publish** workflow runs `tegami ci`:
   - with pending changelogs → opens/updates a **Version Packages** PR
     (`tegami/version-packages`) containing the version bumps + `CHANGELOG.md`.
4. **Merge the Version Packages PR.** The next `tegami ci` run publishes `ap-sdk`
   to npm and creates the GitHub release. The publish lock lives in git, so a
   failed publish can be retried safely.

</workflow>

<rules>

- MUST NOT bump `version` in `package.json` by hand — Tegami owns versions.
- MUST NOT publish manually from a workstation; publishing happens in CI.
- The generated `CHANGELOG.md` is rendered at `/docs/changelog` on the docs site —
  keep changelog notes user-facing and readable.

</rules>

---

## 5. Changelog Authoring

<context>
A changelog file is markdown under `.tegami/` with a `packages` frontmatter key.
Two styles are accepted.
</context>

<examples>
<example type="explicit">
<output>
```md
---
packages:
  "ap-sdk": minor
---

## Add the Windsurf harness

`ap-sdk` now emits `.windsurf/` workflows and rules.
```
</output>
</example>
<example type="implicit">
<output>
```md
---
packages: ["ap-sdk"]
---

# Rename the package to ap-sdk

The published name and CLI are now `ap-sdk`.

## Add a compact code-block option
```

Heading depth sets the bump: `#` → major, `##` → minor, `###` → patch. The
highest bump found in the file wins.
</output>
</example>
</examples>

<rules>

- Each user-facing change to `ap-sdk` MUST ship with a changelog file.
- The bump type MUST follow §3 (Versioning).
- The top heading of each section MUST read as a release note (what changed and
  why), not an implementation diff.

</rules>

---

## 6. Editing This File

<rules>

- MUST follow the global AGENTS.md style: wrap sections in semantic XML tags, use
  uppercase RFC 2119 keywords for normative requirements, lowercase otherwise.
- Project rules that replace a global rule MUST be wrapped in
  `<project-override section="…">`; everything else is additive.
- MUST NOT let RFC/XML conventions surface in user-facing responses.

</rules>
