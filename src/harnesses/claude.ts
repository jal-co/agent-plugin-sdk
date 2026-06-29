import { homedir } from "node:os";
import { join } from "node:path";
import type { OutputFile, Plugin } from "../types.js";
import { compact, mapValues, renderFrontmatterDoc } from "../util/frontmatter.js";
import type { Harness, InstallScope } from "./types.js";
import {
  emitCommandFile,
  emitContextFile,
  emitSkillDir,
  json,
  rewriteArgsToZeroBased,
} from "./shared.js";
import { toClaudeEntry } from "./mcp.js";
import { buildMatcherHooks } from "./hooks.js";
import { mcpServerEntry, toolServerMcp } from "./tools.js";

/**
 * Claude Code emitter.
 *
 * Plugin layout (docs: code.claude.com/docs/en/plugins-reference):
 *   <root>/.claude-plugin/plugin.json
 *   <root>/skills/<name>/SKILL.md
 *
 * Skill frontmatter recognizes `name`, `description`, `allowed-tools` (among
 * others). `allowed-tools` is the documented space/comma list form.
 */
export const claude: Harness = {
  specificationVersion: "v1",
  id: "claude",
  displayName: "Claude Code",

  // Claude Code is the reference harness: it natively supports every portable feature.
  supports: {
    instructions: true,
    skills: true,
    commands: true,
    subagents: true,
    hooks: true,
    mcpServers: true,
    tools: true,
  },

  contextFileName: "CLAUDE.md",

  emit(plugin: Plugin): OutputFile[] {
    const files: OutputFile[] = [];

    if (plugin.instructions?.trim()) {
      files.push(
        emitContextFile(plugin.id, plugin.instructions, this.contextFileName),
      );
    }

    files.push({
      path: ".claude-plugin/plugin.json",
      content: json(
        compact({
          name: plugin.id,
          version: plugin.version ?? "0.0.0",
          description: plugin.description,
          author: plugin.author,
          homepage: plugin.homepage,
          license: plugin.license,
        }),
      ),
    });

    // Optional marketplace manifest for `/plugin marketplace add`.
    if (plugin.marketplace) {
      files.push({
        path: ".claude-plugin/marketplace.json",
        content: json({
          name: plugin.id,
          owner: plugin.marketplace.owner,
          plugins: [
            {
              name: plugin.id,
              source: plugin.marketplace.source ?? ".",
              description: plugin.description,
            },
          ],
        }),
      });
    }

    for (const skill of plugin.skills ?? []) {
      const frontmatter = compact({
        name: skill.name,
        description: skill.description,
        "allowed-tools": skill.allowedTools?.join(" "),
      });
      files.push(...emitSkillDir(skill, frontmatter, "skills"));
    }

    for (const command of plugin.commands ?? []) {
      const frontmatter = compact({
        description: command.description,
        "argument-hint": command.argumentHint,
        "allowed-tools": command.allowedTools?.join(" "),
        model: command.harness?.claude?.model,
      });
      files.push(
        emitCommandFile(
          command.name,
          frontmatter,
          rewriteArgsToZeroBased(command.body),
          "commands",
        ),
      );
    }

    // Subagents: agents/<name>.md in the plugin root, body = system prompt.
    for (const agent of plugin.subagents ?? []) {
      const frontmatter = compact({
        name: agent.name,
        description: agent.description,
        tools: agent.tools?.join(", "),
        model: agent.harness?.claude?.model,
      });
      files.push({
        path: `agents/${agent.name}.md`,
        content: renderFrontmatterDoc(frontmatter, agent.prompt),
      });
    }

    // MCP servers: a .mcp.json at the plugin root is auto-discovered by Claude
    // Code. Custom tools are exposed here too — as a generated MCP stdio server.
    const mcpEntries: Record<string, unknown> = mapValues(
      plugin.mcpServers ?? {},
      toClaudeEntry,
    );
    if (plugin.tools) {
      mcpEntries[`${plugin.id}-tools`] = toClaudeEntry(
        toolServerMcp("${CLAUDE_PLUGIN_ROOT}"),
      );
      files.push({
        path: "mcp/server.ts",
        content: mcpServerEntry(plugin.id),
      });
    }
    if (Object.keys(mcpEntries).length > 0) {
      files.push({ path: ".mcp.json", content: json({ mcpServers: mcpEntries }) });
    }

    // Hooks: hooks/hooks.json bundled in the plugin, auto-loaded on install.
    const hooks = buildMatcherHooks(plugin.hooks ?? [], "claude");
    if (hooks) files.push({ path: "hooks/hooks.json", content: json(hooks) });

    return files;
  },

  skillInstallDir(scope: InstallScope, name: string): string {
    const root =
      scope === "global"
        ? join(homedir(), ".claude", "skills")
        : join(".claude", "skills");
    return join(root, name);
  },

  commandInstallPath(scope: InstallScope, name: string): string {
    const root =
      scope === "global"
        ? join(homedir(), ".claude", "commands")
        : join(".claude", "commands");
    return join(root, `${name}.md`);
  },

  mcpInstall(scope: InstallScope) {
    // Project scope → the shared, version-controlled .mcp.json. Global → the
    // per-user ~/.claude.json. Both merge under the `mcpServers` key.
    const path =
      scope === "global"
        ? join(homedir(), ".claude.json")
        : join(".mcp.json");
    return { path, mergeKey: "mcpServers", convert: toClaudeEntry };
  },

  contextInstallPath(scope: InstallScope): string {
    return scope === "global"
      ? join(homedir(), ".claude", "CLAUDE.md")
      : join("CLAUDE.md");
  },

  subagentInstallPath(scope: InstallScope, name: string): string {
    const root =
      scope === "global"
        ? join(homedir(), ".claude", "agents")
        : join(".claude", "agents");
    return join(root, `${name}.md`);
  },

  buildHookConfig(hooks) {
    return buildMatcherHooks(hooks, "claude") as
      | { hooks: Record<string, unknown[]> }
      | null;
  },

  hookInstall(scope: InstallScope): string {
    // Claude reads hooks from settings.json under the "hooks" key.
    return scope === "global"
      ? join(homedir(), ".claude", "settings.json")
      : join(".claude", "settings.json");
  },
};
