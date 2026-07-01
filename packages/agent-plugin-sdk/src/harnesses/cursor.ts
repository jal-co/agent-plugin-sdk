import { homedir } from "node:os";
import { join } from "node:path";
import type { OutputFile, Plugin } from "../types.js";
import { compact, mapValues } from "../util/frontmatter.js";
import type { Harness, InstallScope } from "./types.js";
import { emitContextFile, json } from "./shared.js";
import { toCursorEntry } from "./mcp.js";
import { mcpServerEntry, toolServerMcp } from "./tools.js";

/**
 * Cursor emitter (docs: cursor.com/docs/context).
 *
 * Cursor reads customization directly from the repo:
 *   AGENTS.md                       always-on instructions (Cursor reads AGENTS.md)
 *   .cursor/commands/<name>.md      slash commands (plain markdown)
 *   .cursor/mcp.json                MCP servers (`mcpServers` map)
 *
 * Cursor has no Agent Skills (SKILL.md) standard, no subagent concept, and its
 * hooks don't map onto the portable lifecycle events — those degrade to
 * structured warnings rather than wrong artifacts. Cursor's own reusable-context
 * mechanism is "rules" (`.cursor/rules/*.mdc`), which the plugin-level
 * `instructions` already targets via AGENTS.md.
 */
export const cursor: Harness = {
  specificationVersion: "v1",
  id: "cursor",
  displayName: "Cursor",

  supports: {
    instructions: true,
    skills: false,
    commands: true,
    subagents: false,
    hooks: false,
    mcpServers: true,
    tools: true,
  },

  unsupportedDetails: {
    skills:
      "Cursor has no Agent Skills (SKILL.md) standard — express reusable guidance as plugin `instructions` (Cursor rules / AGENTS.md) instead.",
    subagents:
      "Cursor has no subagent concept — port the agent to a rule or a slash command.",
    hooks:
      "Cursor hooks use their own event set (beforeShellExecution, afterFileEdit, …) that doesn't map onto the portable lifecycle events.",
  },

  contextFileName: "AGENTS.md",

  emit(plugin: Plugin): OutputFile[] {
    const files: OutputFile[] = [];

    if (plugin.instructions?.trim()) {
      files.push(
        emitContextFile(plugin.id, plugin.instructions, this.contextFileName),
      );
    }

    // Commands: plain markdown under .cursor/commands/. The filename is the
    // slash-command name; Cursor appends the user's input, so the body is passed
    // through untouched.
    for (const command of plugin.commands ?? []) {
      files.push({
        path: `.cursor/commands/${command.name}.md`,
        content: command.body.trimEnd() + "\n",
      });
    }

    // MCP: `.cursor/mcp.json` (`mcpServers` map, Claude-like). Custom tools ride
    // along as a generated MCP server addressed with `${workspaceFolder}`.
    const mcpEntries: Record<string, unknown> = mapValues(
      plugin.mcpServers ?? {},
      toCursorEntry,
    );
    if (plugin.tools) {
      mcpEntries[`${plugin.id}-tools`] = toCursorEntry(
        toolServerMcp("${workspaceFolder}"),
      );
      files.push({ path: "mcp/server.ts", content: mcpServerEntry(plugin.id) });
    }
    if (Object.keys(mcpEntries).length > 0) {
      files.push({
        path: ".cursor/mcp.json",
        content: json({ mcpServers: mcpEntries }),
      });
    }

    return files;
  },

  // Skills aren't supported (see `supports`); the path is unused but required by
  // the interface.
  skillInstallDir(scope: InstallScope, name: string): string {
    return scope === "global"
      ? join(homedir(), ".cursor", "skills", name)
      : join(".cursor", "skills", name);
  },

  filesInstallDir(scope: InstallScope) {
    return scope === "global" ? join(homedir(), ".cursor") : ".cursor";
  },

  commandInstallPath(scope: InstallScope, name: string): string {
    return scope === "global"
      ? join(homedir(), ".cursor", "commands", `${name}.md`)
      : join(".cursor", "commands", `${name}.md`);
  },

  mcpInstall(scope: InstallScope) {
    const path =
      scope === "global"
        ? join(homedir(), ".cursor", "mcp.json")
        : join(".cursor", "mcp.json");
    return { path, mergeKey: "mcpServers", convert: toCursorEntry };
  },

  contextInstallPath(scope: InstallScope): string {
    return scope === "global"
      ? join(homedir(), ".cursor", "AGENTS.md")
      : join("AGENTS.md");
  },

  // No subagent concept.
  subagentInstallPath: () => null,
  subagentNote: "Cursor has no subagent concept.",

  // No declarative hooks that map onto the portable events.
  buildHookConfig: () => null,
  hookInstall: () => null,
  hookInstallNote:
    "Cursor hooks use a different event model; not emitted from portable hooks.",
};
