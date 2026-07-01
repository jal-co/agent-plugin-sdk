# API reference generation decision

## Tried

1. Fumadocs TypeScript integration was evaluated first because it is native to the docs stack. For this repo, the current private docs app already has a custom MDX/code-block pipeline and no existing TypeScript-docs wiring; adding the integration would require new runtime components and dependency churn before proving the output shape.
2. TypeDoc markdown was considered as a fallback, but it would add a larger generator dependency and produce markdown that needs additional filtering to avoid noisy internals.

## Choice

Use a small repo-local generator at `apps/docs/scripts/generate-api-docs.mjs`. It writes source-aligned API metadata for the public entrypoints to MDX pages under `apps/docs/content/docs/api/`.

This meets the bar for v1:

- JSDoc descriptions are visible on the rendered pages.
- Generated MDX uses ordinary fenced code and does not fight the custom CodeBlock pipeline.
- Regeneration is reproducible with `pnpm --filter @jal-co/docs generate:api` and runs before docs build.

## Spot checks

The generated reference includes `definePlugin`, `Skill`, `Hook`, and `defineHarness` with source-derived summaries.
