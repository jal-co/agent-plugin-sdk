import { homedir } from "node:os";
import { join } from "node:path";
import type { OutputFile, Plugin } from "../types.js";
import { compact, mapValues, renderFrontmatterDoc } from "../util/frontmatter.js";
import type { EmitContext, Harness, InstallScope } from "./types.js";
import { emitContextFile, emitSkillDir, json } from "./shared.js";
import { toCopilotEntry } from "./mcp.js";
import { buildCopilotHooks } from "./hooks.js";
import { mcpServerEntry, toolServerMcp } from "./tools.js";

/**
 * GitHub Copilot emitter (the repo + VS Code customization surface; docs:
 * code.visualstudio.com/docs/agent-customization, docs.github.com/copilot).
 *
 * Copilot reads customization files directly from the repository, so the output
 * tree uses the real paths Copilot loads (no plugin-manifest wrapper):
 *   .github/copilot-instructions.md     repo-wide instructions
 *   .github/skills/<name>/SKILL.md       Agent Skills (open standard)
 *   .github/prompts/<name>.prompt.md     prompt files (slash commands)
 *   .github/agents/<name>.agent.md       custom agents (subagents)
 *   .github/copilot/hooks.json           hooks (PascalCase events)
 *   .vscode/mcp.json                     MCP servers (`servers` map)
 */
export const copilot: Harness = {
  specificationVersion: "v1",
  id: "copilot",
  displayName: "GitHub Copilot",

  // Copilot's VS Code surface natively supports every portable feature.
  supports: {
    instructions: true,
    skills: true,
    commands: true,
    subagents: true,
    hooks: true,
    mcpServers: true,
    tools: true,
  },

  contextFileName: ".github/copilot-instructions.md",

  emit(plugin: Plugin, ctx: EmitContext): OutputFile[] {
    const files: OutputFile[] = [];

    if (plugin.instructions?.trim()) {
      files.push(
        emitContextFile(plugin.id, plugin.instructions, this.contextFileName),
      );
    }

    // Skills: standard Agent Skills under .github/skills/. Copilot recognizes
    // name/description plus disable-model-invocation (argument-hint too).
    for (const skill of plugin.skills ?? []) {
      const frontmatter = compact({
        name: skill.name,
        description: skill.description,
        "disable-model-invocation": skill.disableModelInvocation || undefined,
      });
      files.push(...emitSkillDir(skill, frontmatter, ".github/skills"));
    }

    // Commands → prompt files (.github/prompts/<name>.prompt.md). Copilot appends
    // the user's chat input, so the body passes through untouched.
    for (const command of plugin.commands ?? []) {
      const frontmatter = compact({
        description: command.description,
        "argument-hint": command.argumentHint,
        agent: command.harness?.copilot?.agent,
        model: command.harness?.copilot?.model,
      });
      files.push({
        path: `.github/prompts/${command.name}.prompt.md`,
        content: renderFrontmatterDoc(frontmatter, command.body),
      });
    }

    // Subagents → custom agents (.github/agents/<name>.agent.md). VS Code format:
    // YAML frontmatter (name, description, tools as a list, model), body = prompt.
    for (const agent of plugin.subagents ?? []) {
      const frontmatter = compact({
        name: agent.name,
        description: agent.description,
        tools: agent.tools,
        model: agent.harness?.copilot?.model,
      });
      files.push({
        path: `.github/agents/${agent.name}.agent.md`,
        content: renderFrontmatterDoc(frontmatter, agent.prompt),
      });
    }

    // MCP servers (and custom tools as a generated MCP server) → .vscode/mcp.json
    // under the `servers` key, using `${workspaceFolder}` for bundled paths.
    const mcpEntries: Record<string, unknown> = mapValues(
      plugin.mcpServers ?? {},
      toCopilotEntry,
    );
    if (plugin.tools) {
      mcpEntries[`${plugin.id}-tools`] = toCopilotEntry(
        toolServerMcp("${workspaceFolder}"),
      );
      files.push({ path: "mcp/server.ts", content: mcpServerEntry(plugin.id) });
    }
    if (Object.keys(mcpEntries).length > 0) {
      files.push({
        path: ".vscode/mcp.json",
        content: json({ servers: mcpEntries }),
      });
    }

    // Hooks: PascalCase events, flat (no matcher slot) — warn if a matcher was set.
    for (const hook of plugin.hooks ?? []) {
      if (hook.matcher) {
        ctx.warn({
          type: "unsupported-option",
          harness: "copilot",
          feature: "hooks",
          option: "matcher",
          items: [`${hook.event}:${hook.matcher}`],
          details:
            "Copilot hooks fire per-event and inspect `tool_name` themselves; the matcher is dropped.",
        });
      }
    }
    const hooks = buildCopilotHooks(plugin.hooks ?? [], ctx);
    if (hooks) {
      files.push({
        path: ".github/copilot/hooks.json",
        content: json(hooks),
      });
    }

    return files;
  },

  skillInstallDir(scope: InstallScope, name: string): string {
    return scope === "global"
      ? join(homedir(), ".copilot", "skills", name)
      : join(".github", "skills", name);
  },

  commandInstallPath(scope: InstallScope, name: string): string {
    // Workspace prompt files live in .github/prompts; user prompts live in profile data.
    return scope === "global"
      ? join(homedir(), ".copilot", "prompts", `${name}.prompt.md`)
      : join(".github", "prompts", `${name}.prompt.md`);
  },

  mcpInstall(scope: InstallScope) {
    // VS Code reads workspace MCP from .vscode/mcp.json (servers map).
    const path =
      scope === "global"
        ? join(homedir(), ".copilot", "mcp.json")
        : join(".vscode", "mcp.json");
    return { path, mergeKey: "servers", convert: toCopilotEntry };
  },

  contextInstallPath(scope: InstallScope): string {
    return scope === "global"
      ? join(homedir(), ".copilot", "copilot-instructions.md")
      : join(".github", "copilot-instructions.md");
  },

  subagentInstallPath(scope: InstallScope, name: string): string {
    return scope === "global"
      ? join(homedir(), ".copilot", "agents", `${name}.agent.md`)
      : join(".github", "agents", `${name}.agent.md`);
  },

  buildHookConfig(hooks) {
    return buildCopilotHooks(hooks) as
      | { hooks: Record<string, unknown[]> }
      | null;
  },

  hookInstall(scope: InstallScope): string {
    return scope === "global"
      ? join(homedir(), ".copilot", "hooks.json")
      : join(".github", "copilot", "hooks.json");
  },
  hookInstallNote:
    "Copilot hooks use PascalCase events; verify the location against the VS Code hooks docs for your version.",
};
