import { homedir } from "node:os";
import { join } from "node:path";
import type { OutputFile, Plugin } from "../types.js";
import {
  compact,
  mapValues,
  renderFrontmatterDoc,
} from "../util/frontmatter.js";
import type { EmitContext, Harness, InstallScope } from "./types.js";
import {
  emitCommandFile,
  emitContextFile,
  emitSkillDir,
  json,
} from "./shared.js";
import { toOpenCodeEntry } from "./mcp.js";
import { openCodePluginEntry } from "./tools.js";

/** OpenCode config schema URL, recommended in every opencode.json. */
const OPENCODE_SCHEMA = "https://opencode.ai/config.json";

/**
 * OpenCode (sst/opencode) emitter.
 *
 * OpenCode reads skills natively from `.opencode/skills/<name>/SKILL.md`. There
 * is no manifest required for a skills-only bundle, so we emit the skill dirs
 * under `skills/` plus a small `aps.json` describing the bundle (purely
 * informational — OpenCode ignores it) so the output root is self-describing.
 *
 * Recognized frontmatter fields: `name` (must equal the dir name), `description`
 * (1-1024 chars), `license`, `compatibility`, `metadata`. `allowed-tools` is
 * best-effort and not part of the documented recognized set, so it is dropped.
 */
export const opencode: Harness = {
  specificationVersion: "v1",
  id: "opencode",
  displayName: "OpenCode",

  // OpenCode supports everything except declarative hooks (its hooks are
  // TypeScript plugin callbacks).
  supports: {
    instructions: true,
    skills: true,
    commands: true,
    subagents: true,
    hooks: false,
    mcpServers: true,
    tools: true,
  },
  unsupportedDetails: {
    hooks:
      "OpenCode hooks are TypeScript plugin callbacks (e.g. `tool.execute.before`) — implement them in a plugin.",
  },

  contextFileName: "AGENTS.md",

  emit(plugin: Plugin, ctx: EmitContext): OutputFile[] {
    const files: OutputFile[] = [];

    if (plugin.instructions?.trim()) {
      files.push(
        emitContextFile(plugin.id, plugin.instructions, this.contextFileName),
      );
    }

    files.push({
      path: "aps.json",
      content: json(
        compact({
          name: plugin.id,
          version: plugin.version ?? "0.0.0",
          description: plugin.description,
          skills: (plugin.skills ?? []).map((s) => s.name),
        }),
      ),
    });

    for (const skill of plugin.skills ?? []) {
      const frontmatter = compact({
        name: skill.name,
        description: skill.description,
        license: skill.license,
        compatibility: "opencode",
        metadata: skill.metadata,
      });
      files.push(...emitSkillDir(skill, frontmatter, "skills"));
    }

    // OpenCode commands live in commands/ (plural). Body is native 1-based and
    // supports !`shell`/@file injection, all passed through. allowed-tools is not
    // an OpenCode command field, so it is dropped here.
    for (const command of plugin.commands ?? []) {
      const frontmatter = compact({
        description: command.description,
        model: command.harness?.opencode?.model,
      });
      files.push(
        emitCommandFile(command.name, frontmatter, command.body, "commands"),
      );
    }

    // Subagents: agents/<name>.md (plural dir). Body = system prompt. Defaults to
    // mode: subagent. `tools` is deprecated in OpenCode, so it is not emitted here.
    for (const agent of plugin.subagents ?? []) {
      // `tools` is deprecated on OpenCode agents and not emitted; warn rather than
      // silently dropping a restriction the author set.
      if (agent.tools?.length) {
        ctx.warn({
          type: "unsupported-option",
          harness: "opencode",
          feature: "subagents",
          option: "tools",
          items: [agent.name],
          details: "The per-agent `tools` field is deprecated in OpenCode and not emitted.",
        });
      }
      const frontmatter = compact({
        description: agent.description,
        mode: agent.harness?.opencode?.mode ?? "subagent",
        model: agent.harness?.opencode?.model,
      });
      files.push({
        path: `agents/${agent.name}.md`,
        content: renderFrontmatterDoc(frontmatter, agent.prompt),
      });
    }

    // Custom tools: emit an OpenCode plugin entry that exposes them via the shared
    // runtime adapter. Drop it in .opencode/plugins/ or publish as an npm plugin.
    if (plugin.tools) {
      files.push({
        path: "plugin.ts",
        content: openCodePluginEntry(),
      });
    }

    // OpenCode hooks are unsupported (TypeScript plugin callbacks, not declarative
    // config) — the driver strips them and records an `unsupported-feature`
    // warning, so there is nothing to emit for them here.

    // MCP servers go in opencode.json under the `mcp` key. We emit a standalone
    // opencode.json fragment the user merges into their project/global config.
    if (plugin.mcpServers && Object.keys(plugin.mcpServers).length > 0) {
      files.push({
        path: "opencode.json",
        content: json({
          $schema: OPENCODE_SCHEMA,
          mcp: mapValues(plugin.mcpServers, toOpenCodeEntry),
        }),
      });
    }

    return files;
  },

  skillInstallDir(scope: InstallScope, name: string): string {
    const root =
      scope === "global"
        ? join(homedir(), ".config", "opencode", "skills")
        : join(".opencode", "skills");
    return join(root, name);
  },

  commandInstallPath(scope: InstallScope, name: string): string {
    const root =
      scope === "global"
        ? join(homedir(), ".config", "opencode", "commands")
        : join(".opencode", "commands");
    return join(root, `${name}.md`);
  },

  mcpInstall(scope: InstallScope) {
    const path =
      scope === "global"
        ? join(homedir(), ".config", "opencode", "opencode.json")
        : join("opencode.json");
    return {
      path,
      mergeKey: "mcp",
      convert: toOpenCodeEntry,
      defaults: { $schema: OPENCODE_SCHEMA },
    };
  },

  contextInstallPath(scope: InstallScope): string {
    return scope === "global"
      ? join(homedir(), ".config", "opencode", "AGENTS.md")
      : join("AGENTS.md");
  },

  subagentInstallPath(scope: InstallScope, name: string): string {
    const root =
      scope === "global"
        ? join(homedir(), ".config", "opencode", "agents")
        : join(".opencode", "agents");
    return join(root, `${name}.md`);
  },

  buildHookConfig: () => null,
  hookInstall: () => null,
  hookInstallNote:
    "OpenCode hooks are TypeScript plugin callbacks — implement them in a plugin; see createHook in this SDK.",
};
