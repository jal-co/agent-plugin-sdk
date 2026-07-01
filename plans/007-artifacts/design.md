# Distribution spike: template repo + GitHub Action

## Goal & audience

Plugin authors need a five-minute path from idea to public GitHub repository. Consumers already have the matching install path: `ap-sdk install owner/repo` downloads a repository tarball, finds `plugin.ts`, checks compatibility, and installs native artifacts.

## Step 1 transcripts

```text
$ cd packages/agent-plugin-sdk && pnpm cli check examples/git-helper/plugin.ts
✓ git-helper is valid (1 skill(s), 1 command(s), 1 subagent(s), 0 hook(s), 1 MCP server(s), with instructions).
```

```text
$ pnpm cli check https://github.com/jal-co/agent-plugin-sdk --path packages/agent-plugin-sdk/examples/git-helper
✓ Fetched jal-co/agent-plugin-sdk
✓ jal-co/agent-plugin-sdk is a compatible ap-sdk plugin
  git-helper — 1 skill(s), 1 command(s), 1 subagent(s), 0 hook(s), 1 MCP server(s)
```

## Deliverables

1. `jal-co/ap-sdk-plugin-template` — created from `plans/007-artifacts/template`, marked as a template repository, with the `ap-sdk-plugin` topic.
2. `jal-co/ap-sdk-action` — published from `plans/007-artifacts/action.yml`, optionally listed in GitHub Marketplace after v1 stabilizes.
3. `/docs/publishing` — follow-up docs page that links the template, action, registry, and install flow.

## Sync strategy

The template `plugin.ts` should be generated from the same `pluginTemplate()` source used by `ap-sdk init`. A monorepo CI job can regenerate `plans/007-artifacts/template/plugin.ts` and fail on diff so the future external template does not drift.

## Proposed CLI follow-ups

- S: add `ap-sdk build --fail-on-warnings` so CI can enforce full portability instead of only structural validity.
- S: add `ap-sdk init --template-repo` output mode if the external template needs files beyond `plugin.ts` and `.gitignore`.

## Open questions for the operator

- Confirm repository names: `ap-sdk-plugin-template` and `ap-sdk-action`.
- Decide whether the action should be listed in GitHub Marketplace or only referenced from docs.
- Choose action versioning: immutable semver tags plus a moving `v1` tag is recommended.

## Reference artifacts

- Template tree: `plans/007-artifacts/template/`
- Composite action draft: `plans/007-artifacts/action.yml`
