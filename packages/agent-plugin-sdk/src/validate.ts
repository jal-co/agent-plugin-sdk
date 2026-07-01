import type {
  Command,
  Hook,
  HookEvent,
  McpServer,
  Plugin,
  Skill,
  Subagent,
} from "./types.js";

const HOOK_EVENTS: HookEvent[] = [
  "pre-tool-use",
  "post-tool-use",
  "stop",
  "user-prompt-submit",
  "session-start",
  "notification",
  "permission-request",
  "subagent-stop",
  "pre-compact",
  "session-end",
];

/**
 * Raised when a plugin definition is invalid. Carries every problem found in one
 * pass so the developer can fix them all at once — ai-sdk-style "tell me
 * everything that's wrong" DX rather than one-error-at-a-time whack-a-mole.
 */
export class PluginValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(
      `Invalid plugin definition:\n${issues.map((i) => `  • ${i}`).join("\n")}`,
    );
    this.name = "PluginValidationError";
    this.issues = issues;
  }
}

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Tightest shared limits across the four harnesses. */
const SKILL_NAME_MAX = 64;
const SKILL_DESC_MAX = 1024;

function checkSkill(skill: Skill, index: number, issues: string[]): void {
  const where = skill?.name ? `skill "${skill.name}"` : `skills[${index}]`;

  if (!skill || typeof skill !== "object") {
    issues.push(`${where}: must be an object`);
    return;
  }

  if (!skill.name) {
    issues.push(`${where}: \`name\` is required`);
  } else if (!KEBAB.test(skill.name)) {
    issues.push(
      `${where}: \`name\` must be kebab-case (lowercase letters, digits, single hyphens), got "${skill.name}"`,
    );
  } else if (skill.name.length > SKILL_NAME_MAX) {
    issues.push(`${where}: \`name\` must be ≤ ${SKILL_NAME_MAX} chars`);
  }

  if (!skill.description) {
    issues.push(`${where}: \`description\` is required`);
  } else if (skill.description.length > SKILL_DESC_MAX) {
    issues.push(
      `${where}: \`description\` must be ≤ ${SKILL_DESC_MAX} chars (currently ${skill.description.length}). ` +
        `This is OpenCode's hard limit; keep it tight and put detail in the body.`,
    );
  }

  if (!skill.instructions || !skill.instructions.trim()) {
    issues.push(`${where}: \`instructions\` (the skill body) is required`);
  }

  for (const res of skill.resources ?? []) {
    if (!res.path || res.path.startsWith("/") || res.path.includes("..")) {
      issues.push(
        `${where}: resource path "${res.path}" must be a relative path inside the skill dir`,
      );
    }
  }
}

function checkCommand(command: Command, index: number, issues: string[]): void {
  const where = command?.name
    ? `command "${command.name}"`
    : `commands[${index}]`;

  if (!command || typeof command !== "object") {
    issues.push(`${where}: must be an object`);
    return;
  }

  if (!command.name) {
    issues.push(`${where}: \`name\` is required`);
  } else if (!KEBAB.test(command.name)) {
    issues.push(
      `${where}: \`name\` must be kebab-case (lowercase letters, digits, single hyphens), got "${command.name}"`,
    );
  }

  if (!command.description) {
    issues.push(`${where}: \`description\` is required`);
  }

  if (!command.body || !command.body.trim()) {
    issues.push(`${where}: \`body\` (the prompt template) is required`);
  }
}

function checkSubagent(agent: Subagent, index: number, issues: string[]): void {
  const where = agent?.name ? `subagent "${agent.name}"` : `subagents[${index}]`;
  if (!agent || typeof agent !== "object") {
    issues.push(`${where}: must be an object`);
    return;
  }
  if (!agent.name) {
    issues.push(`${where}: \`name\` is required`);
  } else if (!KEBAB.test(agent.name)) {
    issues.push(
      `${where}: \`name\` must be kebab-case (lowercase letters, digits, single hyphens), got "${agent.name}"`,
    );
  }
  if (!agent.description) issues.push(`${where}: \`description\` is required`);
  if (!agent.prompt || !agent.prompt.trim())
    issues.push(`${where}: \`prompt\` (the system prompt) is required`);
}

function checkHook(hook: Hook, index: number, issues: string[]): void {
  const where = `hooks[${index}]`;
  if (!hook || typeof hook !== "object") {
    issues.push(`${where}: must be an object`);
    return;
  }
  if (!hook.event) {
    issues.push(`${where}: \`event\` is required`);
  } else if (!HOOK_EVENTS.includes(hook.event)) {
    issues.push(
      `${where}: \`event\` must be one of ${HOOK_EVENTS.join(", ")}, got "${hook.event}"`,
    );
  }
  const cmd = hook.command;
  const ok =
    typeof cmd === "string"
      ? cmd.trim().length > 0
      : !!cmd && typeof cmd === "object" && !!cmd.bash;
  if (!ok) {
    issues.push(
      `${where}: \`command\` is required (a string, or { bash, powershell? })`,
    );
  }
}

function checkMcpServer(
  name: string,
  server: McpServer,
  issues: string[],
): void {
  const where = `mcpServers["${name}"]`;
  if (!name || !KEBAB.test(name)) {
    issues.push(
      `mcpServers: server name "${name}" must be kebab-case (lowercase letters, digits, single hyphens)`,
    );
  }
  if (!server || typeof server !== "object") {
    issues.push(`${where}: must be an object`);
    return;
  }
  if (server.transport === "http") {
    if (!server.url) issues.push(`${where}: http server requires a \`url\``);
  } else {
    if (!("command" in server) || !server.command) {
      issues.push(
        `${where}: stdio server requires a \`command\` (or set transport: "http" with a url)`,
      );
    }
  }
}

/**
 * Validate a plugin definition, throwing {@link PluginValidationError} with every
 * issue found. Returns the plugin unchanged on success for convenient chaining.
 */
export function validatePlugin(plugin: Plugin): Plugin {
  const issues: string[] = [];

  if (!plugin || typeof plugin !== "object") {
    throw new PluginValidationError(["plugin must be an object"]);
  }

  if (!plugin.id) {
    issues.push("`id` is required");
  } else if (!KEBAB.test(plugin.id)) {
    issues.push(
      `\`id\` must be kebab-case (lowercase letters, digits, single hyphens), got "${plugin.id}"`,
    );
  }

  if (!plugin.description) {
    issues.push("`description` is required");
  }

  if (plugin.version && !/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(plugin.version)) {
    issues.push(`\`version\` must be semver-like, got "${plugin.version}"`);
  }

  const seenSkills = new Set<string>();
  (plugin.skills ?? []).forEach((skill, i) => {
    checkSkill(skill, i, issues);
    if (skill?.name) {
      if (seenSkills.has(skill.name)) {
        issues.push(`duplicate skill name "${skill.name}"`);
      }
      seenSkills.add(skill.name);
    }
  });

  const seenCommands = new Set<string>();
  (plugin.commands ?? []).forEach((command, i) => {
    checkCommand(command, i, issues);
    if (command?.name) {
      if (seenCommands.has(command.name)) {
        issues.push(`duplicate command name "${command.name}"`);
      }
      seenCommands.add(command.name);
    }
  });

  for (const [name, server] of Object.entries(plugin.mcpServers ?? {})) {
    checkMcpServer(name, server, issues);
  }

  if (plugin.tools && !plugin.tools.module) {
    issues.push("`tools.module` is required (path to a module exporting Tool[])");
  }

  (plugin.hooks ?? []).forEach((hook, i) => checkHook(hook, i, issues));

  const seenAgents = new Set<string>();
  (plugin.subagents ?? []).forEach((agent, i) => {
    checkSubagent(agent, i, issues);
    if (agent?.name) {
      if (seenAgents.has(agent.name))
        issues.push(`duplicate subagent name "${agent.name}"`);
      seenAgents.add(agent.name);
    }
  });

  if (issues.length > 0) {
    throw new PluginValidationError(issues);
  }
  return plugin;
}
