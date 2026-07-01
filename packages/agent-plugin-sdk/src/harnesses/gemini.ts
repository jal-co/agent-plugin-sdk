import { homedir } from "node:os";
import { join } from "node:path";
import type { OutputFile, Plugin } from "../types.js";
import { compact, mapValues, mergeFrontmatter, renderFrontmatterDoc } from "../util/frontmatter.js";
import type { EmitContext, Harness, InstallScope } from "./types.js";
import {
  emitContextFile,
  emitSkillDir,
  geminiCommandToml,
  hasPositionalArgs,
  json,
  rewriteArgsToGemini,
} from "./shared.js";
import { toGeminiEntry } from "./mcp.js";
import { buildMatcherHooks } from "./hooks.js";
import { mcpServerEntry, toolServerMcp } from "./tools.js";

/**
 * Gemini CLI emitter.
 *
 * Gemini ships portable features as an **extension** (docs:
 * github.com/google-gemini/gemini-cli/docs/extensions). Layout:
 *   <root>/gemini-extension.json     manifest (name, version, mcpServers, contextFileName)
 *   <root>/GEMINI.md                 context/instructions
 *   <root>/commands/<name>.toml      custom commands (TOML: prompt + description)
 *   <root>/skills/<name>/SKILL.md    agent skills
 *   <root>/agents/<name>.md          sub-agents (md + YAML frontmatter)
 *   <root>/hooks/hooks.json          hooks (NOT in the manifest)
 *
 * MCP lives inside the manifest's `mcpServers` map (not a separate file), using
 * `${extensionPath}` to refer to bundled files.
 */
export const gemini: Harness = {
  specificationVersion: "v1",
  id: "gemini",
  displayName: "Gemini CLI",

  // Gemini supports every portable feature: skills (SKILL.md), TOML commands,
  // GEMINI.md context, sub-agents, hooks, and MCP (incl. custom tools as MCP).
  supports: {
    instructions: true,
    skills: true,
    commands: true,
    subagents: true,
    hooks: true,
    mcpServers: true,
    tools: true,
  },

  contextFileName: "GEMINI.md",

  unsupportedDetails: {},

  emit(plugin: Plugin, ctx: EmitContext): OutputFile[] {
    const files: OutputFile[] = [];

    if (plugin.instructions?.trim()) {
      files.push(
        emitContextFile(plugin.id, plugin.instructions, this.contextFileName),
      );
    }

    // MCP servers (and custom tools, as a generated MCP stdio server) live in the
    // manifest's `mcpServers` map, addressed via `${extensionPath}`.
    const mcpEntries: Record<string, unknown> = mapValues(
      plugin.mcpServers ?? {},
      toGeminiEntry,
    );
    if (plugin.tools) {
      mcpEntries[`${plugin.id}-tools`] = toGeminiEntry(
        toolServerMcp("${extensionPath}"),
      );
      files.push({ path: "mcp/server.ts", content: mcpServerEntry(plugin.id) });
    }
    const hasMcp = Object.keys(mcpEntries).length > 0;

    files.push({
      path: "gemini-extension.json",
      content: json(
        compact({
          name: plugin.id,
          version: plugin.version ?? "0.0.0",
          description: plugin.description,
          contextFileName: plugin.instructions?.trim()
            ? this.contextFileName
            : undefined,
          mcpServers: hasMcp ? mcpEntries : undefined,
        }),
      ),
    });

    // Skills: standard Agent Skills bundle, `skills/<name>/SKILL.md`. Gemini reads
    // the same name/description frontmatter; `allowed-tools` is not recognized.
    for (const skill of plugin.skills ?? []) {
      const frontmatter = compact({
        name: skill.name,
        description: skill.description,
      });
      files.push(...emitSkillDir(skill, frontmatter, "skills"));
    }

    // Commands: TOML under commands/. Gemini has only `{{args}}` (all arguments),
    // so `$ARGUMENTS` is translated and positional `$1`/`$2` get a warning. Shell
    // injection stays passthrough: authors targeting Gemini use its `!{cmd}` form
    // (the portable model already treats `!`cmd`` as Claude/OpenCode-specific).
    for (const command of plugin.commands ?? []) {
      if (hasPositionalArgs(command.body)) {
        ctx.warn({
          type: "unsupported-option",
          harness: "gemini",
          feature: "commands",
          option: "$1/$2 positional arguments",
          items: [command.name],
          details:
            "Gemini commands only support `{{args}}` (all arguments); positional tokens are left literal.",
        });
      }
      files.push({
        path: `commands/${command.name}.toml`,
        content: geminiCommandToml({
          description: command.description,
          prompt: rewriteArgsToGemini(command.body),
        }),
      });
    }

    // Sub-agents: agents/<name>.md, YAML frontmatter (name, description, tools as
    // a list, optional model/temperature/max_turns), body = system prompt.
    for (const agent of plugin.subagents ?? []) {
      const g = agent.harness?.gemini;
      const frontmatter = compact({
        name: agent.name,
        description: agent.description,
        tools: agent.tools,
        model: g?.model,
        temperature: g?.temperature,
        max_turns: g?.maxTurns,
      });
      files.push({
        path: `agents/${agent.name}.md`,
        content: renderFrontmatterDoc(mergeFrontmatter(frontmatter, agent.frontmatter), agent.prompt),
      });
    }

    // Hooks: hooks/hooks.json (Claude-style matcher groups). Gemini timeouts are
    // milliseconds; portable `timeout` is seconds, so scale it.
    const hooks = buildMatcherHooks(
      (plugin.hooks ?? []).map((h) => ({
        ...h,
        timeout: h.timeout !== undefined ? h.timeout * 1000 : undefined,
      })),
      "gemini",
      ctx,
    );
    if (hooks) files.push({ path: "hooks/hooks.json", content: json(hooks) });

    return files;
  },

  skillInstallDir(scope: InstallScope, name: string): string {
    const root =
      scope === "global"
        ? join(homedir(), ".gemini", "skills")
        : join(".gemini", "skills");
    return join(root, name);
  },

  commandInstallPath(scope: InstallScope, name: string): string {
    const root =
      scope === "global"
        ? join(homedir(), ".gemini", "commands")
        : join(".gemini", "commands");
    return join(root, `${name}.toml`);
  },

  mcpInstall(scope: InstallScope) {
    // Gemini reads MCP from settings.json `mcpServers` (project .gemini/ or ~/.gemini/).
    const path =
      scope === "global"
        ? join(homedir(), ".gemini", "settings.json")
        : join(".gemini", "settings.json");
    return { path, mergeKey: "mcpServers", convert: toGeminiEntry };
  },

  contextInstallPath(scope: InstallScope): string {
    return scope === "global"
      ? join(homedir(), ".gemini", "GEMINI.md")
      : join("GEMINI.md");
  },

  subagentInstallPath(scope: InstallScope, name: string): string {
    const root =
      scope === "global"
        ? join(homedir(), ".gemini", "agents")
        : join(".gemini", "agents");
    return join(root, `${name}.md`);
  },

  buildHookConfig(hooks) {
    return buildMatcherHooks(
      hooks.map((h) => ({
        ...h,
        timeout: h.timeout !== undefined ? h.timeout * 1000 : undefined,
      })),
      "gemini",
    ) as { hooks: Record<string, unknown[]> } | null;
  },

  hookInstall(scope: InstallScope): string {
    return scope === "global"
      ? join(homedir(), ".gemini", "settings.json")
      : join(".gemini", "settings.json");
  },
};
