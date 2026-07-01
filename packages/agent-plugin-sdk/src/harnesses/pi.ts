import { homedir } from "node:os";
import { join } from "node:path";
import type { OutputFile, Plugin } from "../types.js";
import { compact } from "../util/frontmatter.js";
import { SDK_VERSION } from "../version.js";
import type { Harness, InstallScope } from "./types.js";
import {
  emitCommandFile,
  emitContextFile,
  emitSkillDir,
  json,
} from "./shared.js";
import { piExtensionEntry } from "./tools.js";

/**
 * Pi (earendil-works/pi) emitter.
 *
 * Pi ships shareable resources as an npm/git "Pi package": a normal package
 * with a `pi` key pointing at conventional dirs, and `keywords: ["pi-package"]`.
 *   <root>/package.json     { pi: { skills: ["./skills"] }, keywords: ["pi-package"] }
 *   <root>/skills/<name>/SKILL.md
 *
 * Pi skill frontmatter recognizes `name`, `description`, `license`,
 * `compatibility`, `metadata`, `allowed-tools`, and `disable-model-invocation`.
 */
export const pi: Harness = {
  specificationVersion: "v1",
  id: "pi",
  displayName: "Pi",

  // Pi is the most divergent target: no subagents, no declarative hooks, no
  // native MCP (all three are code-only in a TypeScript extension). The driver
  // turns each gap into an `unsupported-feature` warning using the details below.
  supports: {
    instructions: true,
    skills: true,
    commands: true,
    subagents: false,
    hooks: false,
    mcpServers: false,
    tools: true,
  },
  unsupportedDetails: {
    subagents:
      "Pi has no subagent concept — port the behavior to a Pi skill or a TypeScript extension.",
    hooks:
      "Pi hooks are TypeScript event handlers (`pi.on(...)`) — implement them in an extension.",
    mcpServers:
      "Pi has no native MCP — install an MCP bridge extension that exposes the server via `pi.registerTool`.",
  },

  contextFileName: "AGENTS.md",

  emit(plugin: Plugin): OutputFile[] {
    const files: OutputFile[] = [];
    const hasSkills = (plugin.skills ?? []).length > 0;
    const hasCommands = (plugin.commands ?? []).length > 0;
    const hasTools = !!plugin.tools;

    if (plugin.instructions?.trim()) {
      files.push(
        emitContextFile(plugin.id, plugin.instructions, this.contextFileName),
      );
    }

    files.push({
      path: "package.json",
      content: json(
        compact({
          name: plugin.id,
          version: plugin.version ?? "0.0.0",
          description: plugin.description,
          keywords: ["pi-package"],
          type: "module",
          author: plugin.author
            ? formatAuthor(plugin.author)
            : undefined,
          homepage: plugin.homepage,
          license: plugin.license,
          // The extension imports the shared runtime; declare it so the package
          // resolves it once installed/published (locally it resolves from the
          // surrounding project).
          dependencies: hasTools
            ? { "agent-plugin-sdk": `^${SDK_VERSION}` }
            : undefined,
          // Pi auto-discovers a prompts/ dir as slash commands and skills/ as skills.
          pi: compact({
            skills: hasSkills ? ["./skills"] : undefined,
            prompts: hasCommands ? ["./prompts"] : undefined,
            extensions: hasTools ? ["./extension.ts"] : undefined,
          }),
        }),
      ),
    });

    for (const skill of plugin.skills ?? []) {
      const frontmatter = compact({
        name: skill.name,
        description: skill.description,
        license: skill.license,
        metadata: skill.metadata,
        "allowed-tools": skill.allowedTools?.join(" "),
        "disable-model-invocation": skill.disableModelInvocation,
      });
      files.push(...emitSkillDir(skill, frontmatter, "skills"));
    }

    // Pi prompt templates are natively 1-based, so the body passes through.
    for (const command of plugin.commands ?? []) {
      const frontmatter = compact({
        description: command.description,
        "argument-hint": command.argumentHint,
      });
      files.push(
        emitCommandFile(
          command.name,
          frontmatter,
          command.body,
          "prompts",
          command.frontmatter,
        ),
      );
    }

    // Custom tools: emit a Pi extension entry that registers them via the shared
    // runtime adapter. The handler logic lives in the user's tools module.
    if (hasTools) {
      files.push({
        path: "extension.ts",
        content: piExtensionEntry(),
      });
    }

    // Subagents, hooks and MCP are unsupported on Pi — the driver strips them and
    // records `unsupported-feature` warnings (see `supports`/`unsupportedDetails`
    // above), so there is nothing to emit for them here.
    return files;
  },

  skillInstallDir(scope: InstallScope, name: string): string {
    const root =
      scope === "global"
        ? join(homedir(), ".pi", "agent", "skills")
        : join(".pi", "skills");
    return join(root, name);
  },

  filesInstallDir(scope: InstallScope) {
    return scope === "global" ? join(homedir(), ".pi") : ".pi";
  },

  commandInstallPath(scope: InstallScope, name: string): string {
    const root =
      scope === "global"
        ? join(homedir(), ".pi", "agent", "prompts")
        : join(".pi", "prompts");
    return join(root, `${name}.md`);
  },

  mcpInstall: () => null,
  mcpInstallNote:
    "Pi has no native MCP. Install an MCP bridge extension (e.g. pi-mcp-extension) to expose MCP tools.",

  contextInstallPath(scope: InstallScope): string {
    return scope === "global"
      ? join(homedir(), ".pi", "agent", "AGENTS.md")
      : join("AGENTS.md");
  },

  subagentInstallPath: () => null,
  subagentNote:
    "Pi has no subagent concept. Port the behavior to a Pi skill or a TS extension.",

  buildHookConfig: () => null,
  hookInstall: () => null,
  hookInstallNote:
    "Pi hooks are TypeScript (`pi.on(...)`) — implement them in an extension; see createHook in this SDK.",
};

function formatAuthor(a: NonNullable<Plugin["author"]>): string {
  let s = a.name;
  if (a.email) s += ` <${a.email}>`;
  if (a.url) s += ` (${a.url})`;
  return s;
}
