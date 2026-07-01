import { homedir } from "node:os";
import { join } from "node:path";
import type { OutputFile, Plugin } from "../types.js";
import { compact, mapValues, renderFrontmatterDoc } from "../util/frontmatter.js";
import type { Harness, InstallScope } from "./types.js";
import { emitContextFile, emitSkillDir, json } from "./shared.js";
import { toWindsurfEntry } from "./mcp.js";
import { mcpServerEntry, toolServerMcp } from "./tools.js";

/**
 * Windsurf (Cascade) emitter (docs: docs.windsurf.com/windsurf/cascade).
 *
 * Windsurf reads customization directly from the repo / Codeium home:
 *   AGENTS.md                             always-on instructions
 *   .windsurf/skills/<name>/SKILL.md       Agent Skills (open standard)
 *   .windsurf/workflows/<name>.md          workflows (manual `/slash` commands)
 *   ~/.codeium/windsurf/mcp_config.json    MCP servers (`mcpServers` map)
 *
 * Windsurf has no subagent concept and no declarative lifecycle hooks, so those
 * degrade to structured warnings rather than wrong artifacts.
 */
export const windsurf: Harness = {
  specificationVersion: "v1",
  id: "windsurf",
  displayName: "Windsurf",

  supports: {
    instructions: true,
    skills: true,
    commands: true,
    subagents: false,
    hooks: false,
    mcpServers: true,
    tools: true,
  },

  unsupportedDetails: {
    subagents:
      "Windsurf has no subagent concept — port the agent to a Skill or a Workflow.",
    hooks:
      "Windsurf has no declarative lifecycle hooks that map onto the portable events.",
  },

  contextFileName: "AGENTS.md",

  emit(plugin: Plugin): OutputFile[] {
    const files: OutputFile[] = [];

    if (plugin.instructions?.trim()) {
      files.push(
        emitContextFile(plugin.id, plugin.instructions, this.contextFileName),
      );
    }

    // Skills: standard Agent Skills under .windsurf/skills/ (name + description).
    for (const skill of plugin.skills ?? []) {
      const frontmatter = compact({
        name: skill.name,
        description: skill.description,
      });
      files.push(...emitSkillDir(skill, frontmatter, ".windsurf/skills"));
    }

    // Commands → workflows (.windsurf/workflows/<name>.md), markdown with a
    // `description` frontmatter. Workflows are manual-only `/slash` commands;
    // Windsurf appends the user's input, so the body passes through.
    for (const command of plugin.commands ?? []) {
      const frontmatter = compact({ description: command.description });
      files.push({
        path: `.windsurf/workflows/${command.name}.md`,
        content: renderFrontmatterDoc(frontmatter, command.body),
      });
    }

    // MCP: a single mcp_config.json (`mcpServers` map). Custom tools ride along
    // as a generated MCP server addressed with `${workspaceFolder}`.
    const mcpEntries: Record<string, unknown> = mapValues(
      plugin.mcpServers ?? {},
      toWindsurfEntry,
    );
    if (plugin.tools) {
      mcpEntries[`${plugin.id}-tools`] = toWindsurfEntry(
        toolServerMcp("${workspaceFolder}"),
      );
      files.push({ path: "mcp/server.ts", content: mcpServerEntry(plugin.id) });
    }
    if (Object.keys(mcpEntries).length > 0) {
      files.push({
        path: "mcp_config.json",
        content: json({ mcpServers: mcpEntries }),
      });
    }

    return files;
  },

  skillInstallDir(scope: InstallScope, name: string): string {
    return scope === "global"
      ? join(homedir(), ".codeium", "windsurf", "skills", name)
      : join(".windsurf", "skills", name);
  },

  filesInstallDir(scope: InstallScope) {
    return scope === "global" ? join(homedir(), ".windsurf") : ".windsurf";
  },

  commandInstallPath(scope: InstallScope, name: string): string {
    return scope === "global"
      ? join(homedir(), ".codeium", "windsurf", "global_workflows", `${name}.md`)
      : join(".windsurf", "workflows", `${name}.md`);
  },

  mcpInstall() {
    // Windsurf MCP is global-only — a single ~/.codeium/windsurf/mcp_config.json.
    return {
      path: join(homedir(), ".codeium", "windsurf", "mcp_config.json"),
      mergeKey: "mcpServers",
      convert: toWindsurfEntry,
    };
  },
  mcpInstallNote:
    "Windsurf MCP is global-only (~/.codeium/windsurf/mcp_config.json).",

  contextInstallPath(scope: InstallScope): string {
    return scope === "global"
      ? join(homedir(), ".codeium", "windsurf", "memories", "global_rules.md")
      : join("AGENTS.md");
  },

  subagentInstallPath: () => null,
  subagentNote: "Windsurf has no subagent concept.",

  buildHookConfig: () => null,
  hookInstall: () => null,
  hookInstallNote: "Windsurf has no declarative lifecycle hooks.",
};
