# planreview — a full-feature example

A plannotator-scale plugin authored **once** that compiles to native artifacts for
Claude Code, Codex, Pi, and OpenCode. It exercises every SDK feature.

- [`plugin.ts`](plugin.ts) — the single portable definition (skills, commands, subagents,
  hooks, MCP, instructions, custom tools, marketplace).
- [`tools.ts`](tools.ts) — the shared tool handlers (`review_diff`, `annotate_file`),
  written once and wired into every harness's runtime.

## Generate it

```bash
npx tsx node_modules/.bin/ap-sdk build examples/planreview/plugin.ts -o examples/planreview/dist
```

## What each harness gets

| Feature | Claude | Codex | Pi | OpenCode |
|---|---|---|---|---|
| Instructions | `CLAUDE.md` | `AGENTS.md` | `AGENTS.md` | `AGENTS.md` |
| Skill | `skills/diff-review/` | `skills/…` | `skills/…` | `skills/…` |
| Commands | `commands/*.md` | `prompts/*.md` | `prompts/*.md` | `commands/*.md` |
| Subagent | `agents/pr-reviewer.md` | `agents/pr-reviewer.toml` | *warning* | `agents/pr-reviewer.md` |
| Hooks | `hooks/hooks.json` | `hooks/hooks.json` + README | *warning* | *warning* |
| Custom tools | MCP server + `.mcp.json` | MCP server + `.mcp.json` | `extension.ts` | `plugin.ts` |
| MCP (github) | `.mcp.json` | `.mcp.json` | *warning* | `opencode.json` |
| Marketplace | `marketplace.json` | — | — | — |

The build copies `tools.ts` into every harness output, so the generated glue
(`mcp/server.ts`, `extension.ts`, `plugin.ts`) imports it directly — no manual copy.

The Pi target is a complete `pi-package`: its `package.json` wires `skills`, `prompts`,
and `extensions`. What Pi can't do declaratively (MCP, subagents, hooks — all code-only
there) comes back as structured `build` **warnings**, not files in the tree:

```
pi   7 files (3 warnings)
  ∅ subagents (pr-reviewer): Pi has no subagent concept — …
  ∅ hooks (…): Pi hooks are TypeScript (`pi.on(...)`) — …
  ∅ mcpServers (github): Pi has no native MCP — …
```

## The shared tools really run

`build` copies `tools.ts` into each output, so the generated MCP server runs with `tsx` —
no manual copy:

```bash
npx tsx examples/planreview/dist/claude/mcp/server.ts   # speaks MCP over stdio
```

Or skip the harness entirely and invoke a handler in-process:

```bash
ap-sdk tools                       # list the plugin's tools
ap-sdk tools --call review_diff    # run one and print the result
```

In Pi and OpenCode the same handlers run via the generated `extension.ts` / `plugin.ts`.
