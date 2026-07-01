import { homedir } from "node:os";
import { join } from "node:path";
import type { OutputFile, Plugin } from "../types.js";
import { compact } from "../util/frontmatter.js";
import type { EmitContext, Harness, InstallScope } from "./types.js";
import {
  codexAgentToml,
  emitCommandFile,
  emitContextFile,
  emitSkillDir,
  json,
} from "./shared.js";
import { toCodexEntry } from "./mcp.js";
import { buildMatcherHooks } from "./hooks.js";
import { mcpServerEntry, toolServerMcp } from "./tools.js";
import { mapValues } from "../util/frontmatter.js";

/**
 * Codex (OpenAI) emitter.
 *
 * Plugin layout (docs: developers.openai.com/codex/plugins/build):
 *   <root>/.codex-plugin/plugin.json   (manifest points at ./skills/)
 *   <root>/skills/<name>/SKILL.md
 *
 * Codex skill frontmatter is intentionally minimal: only `name` and
 * `description`, both required. Richer metadata would live in agents/openai.yaml
 * (not needed for portable skills). `allowed-tools` is NOT a recognized field
 * here, so it is dropped for this target.
 */
export const codex: Harness = {
  specificationVersion: "v1",
  id: "codex",
  displayName: "Codex",

  // Codex supports every portable feature natively (subagents as TOML, hooks via
  // .codex/hooks.json, MCP via a bundled .mcp.json).
  supports: {
    instructions: true,
    skills: true,
    commands: true,
    subagents: true,
    hooks: true,
    mcpServers: true,
    tools: true,
  },

  contextFileName: "AGENTS.md",

  emit(plugin: Plugin, ctx: EmitContext): OutputFile[] {
    const files: OutputFile[] = [];
    const hasMcp =
      !!plugin.mcpServers && Object.keys(plugin.mcpServers).length > 0;
    const hasMcpFile = hasMcp || !!plugin.tools;

    if (plugin.instructions?.trim()) {
      files.push(
        emitContextFile(plugin.id, plugin.instructions, this.contextFileName),
      );
    }

    files.push({
      path: ".codex-plugin/plugin.json",
      content: json(
        compact({
          name: plugin.id,
          version: plugin.version ?? "0.0.0",
          description: plugin.description,
          skills: "./skills/",
          mcpServers: hasMcpFile ? "./.mcp.json" : undefined,
          author: plugin.author,
          homepage: plugin.homepage,
          license: plugin.license,
        }),
      ),
    });

    for (const skill of plugin.skills ?? []) {
      const frontmatter = {
        name: skill.name,
        description: skill.description,
      };
      files.push(...emitSkillDir(skill, frontmatter, "skills"));
    }

    // Codex custom prompts cannot be bundled inside a .codex-plugin and are not
    // project-scoped — they live only in ~/.codex/prompts/. We still emit them
    // under prompts/ so `build` output is complete and inspectable; `install`
    // places them in the user's Codex home. Frontmatter is minimal (description,
    // argument-hint) and Codex is natively 1-based, so the body passes through.
    for (const command of plugin.commands ?? []) {
      const frontmatter = compact({
        description: command.description,
        "argument-hint": command.argumentHint,
      });
      files.push(
        emitCommandFile(command.name, frontmatter, command.body, "prompts"),
      );
    }

    // Subagents are TOML files (developer_instructions = system prompt). They
    // can't be bundled in a .codex-plugin, but ARE project-scoped (.codex/agents/),
    // so we emit them under agents/ for build and install them per-scope.
    for (const agent of plugin.subagents ?? []) {
      // Codex agents have no per-agent tool allowlist; warn rather than silently
      // dropping a `tools` restriction the author set (ai-sdk `unsupported-setting`).
      if (agent.tools?.length) {
        ctx.warn({
          type: "unsupported-option",
          harness: "codex",
          feature: "subagents",
          option: "tools",
          items: [agent.name],
          details: "Codex agents have no per-agent tool allowlist.",
        });
      }
      files.push({
        path: `agents/${agent.name}.toml`,
        content: codexAgentToml({
          name: agent.name,
          description: agent.description,
          model: agent.harness?.codex?.model,
          developerInstructions: agent.prompt,
        }),
      });
    }

    // MCP servers: a .mcp.json at the plugin root, referenced by plugin.json.
    // Codex uses the direct-map form (no top-level wrapper) and no `type` field.
    // Custom tools are exposed as a generated MCP stdio server entry too.
    const mcpEntries: Record<string, unknown> = mapValues(
      plugin.mcpServers ?? {},
      toCodexEntry,
    );
    if (plugin.tools) {
      mcpEntries[`${plugin.id}-tools`] = toCodexEntry(toolServerMcp("."));
      files.push({
        path: "mcp/server.ts",
        content: mcpServerEntry(plugin.id),
      });
    }
    if (hasMcpFile) {
      files.push({ path: ".mcp.json", content: json(mcpEntries) });
    }

    // Hooks: Codex reads .codex/hooks.json (project) or ~/.codex/hooks.json, and
    // requires `[features] hooks = true` in config.toml. Not plugin-bundleable, so
    // we emit the file under hooks/ for build plus a note about the feature flag.
    const hooks = buildMatcherHooks(plugin.hooks ?? [], "codex", ctx);
    if (hooks) {
      files.push({ path: "hooks/hooks.json", content: json(hooks) });
      files.push({
        path: "hooks/README.md",
        content:
          `# Codex hooks\n\nCopy \`hooks.json\` to \`~/.codex/hooks.json\` (or \`<repo>/.codex/hooks.json\`) ` +
          `and enable the feature flag in \`config.toml\`:\n\n\`\`\`toml\n[features]\nhooks = true\n\`\`\`\n\n` +
          `Codex hooks are experimental; \`Stop\` is the most reliable event.\n`,
      });
    }

    return files;
  },

  skillInstallDir(scope: InstallScope, name: string): string {
    // Codex discovers skills under .agents/skills (project) and ~/.agents/skills (global).
    const root =
      scope === "global"
        ? join(homedir(), ".agents", "skills")
        : join(".agents", "skills");
    return join(root, name);
  },

  commandsGlobalOnly: true,

  filesInstallDir(scope: InstallScope) {
    return scope === "global" ? join(homedir(), ".codex") : ".codex";
  },

  commandInstallPath(_scope: InstallScope, name: string): string {
    // Always the Codex home prompts dir, regardless of requested scope.
    return join(homedir(), ".codex", "prompts", `${name}.md`);
  },

  // Codex reads user MCP from ~/.codex/config.toml (TOML), and plugin MCP from a
  // bundled .mcp.json. There is no standalone JSON merge target, so MCP ships via
  // the generated plugin (build), not standalone install.
  mcpInstall: () => null,
  mcpInstallNote:
    "Codex MCP installs via the generated plugin (build output), or add it to ~/.codex/config.toml manually.",

  contextInstallPath(scope: InstallScope): string {
    return scope === "global"
      ? join(homedir(), ".codex", "AGENTS.md")
      : join("AGENTS.md");
  },

  subagentInstallPath(scope: InstallScope, name: string): string {
    const root =
      scope === "global"
        ? join(homedir(), ".codex", "agents")
        : join(".codex", "agents");
    return join(root, `${name}.toml`);
  },

  buildHookConfig(hooks) {
    return buildMatcherHooks(hooks, "codex") as
      | { hooks: Record<string, unknown[]> }
      | null;
  },

  hookInstall(scope: InstallScope): string {
    // Codex reads .codex/hooks.json (project) or ~/.codex/hooks.json (global).
    // Remember to also set `[features] hooks = true` in config.toml.
    return scope === "global"
      ? join(homedir(), ".codex", "hooks.json")
      : join(".codex", "hooks.json");
  },
  hookInstallNote: "Also set `[features] hooks = true` in Codex config.toml.",
};
