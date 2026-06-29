import type { OutputFile, Skill } from "../types.js";
import { renderFrontmatterDoc } from "../util/frontmatter.js";

/**
 * Emit a skill directory: the `SKILL.md` (with the harness-specific frontmatter
 * passed in) plus any bundled resource files, all under `<dirPrefix>/<name>/`.
 *
 * Each harness decides which frontmatter fields it recognizes and passes the
 * resulting object here; the body, directory layout, and resource handling are
 * identical everywhere, so they live in one place.
 */
export function emitSkillDir(
  skill: Skill,
  frontmatter: Record<string, unknown>,
  dirPrefix: string,
): OutputFile[] {
  const base = `${dirPrefix}/${skill.name}`;
  const files: OutputFile[] = [
    {
      path: `${base}/SKILL.md`,
      content: renderFrontmatterDoc(frontmatter, skill.instructions),
    },
  ];
  for (const res of skill.resources ?? []) {
    files.push({
      path: `${base}/${res.path}`,
      content: res.content,
      executable: res.executable,
    });
  }
  return files;
}

/** Serialize a manifest object to pretty JSON with a trailing newline. */
export function json(data: unknown): string {
  return JSON.stringify(data, null, 2) + "\n";
}

/** Escape a TOML single-line basic string value (without surrounding quotes). */
function tomlBasic(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
}

/**
 * Serialize a Codex subagent TOML file. Codex agents are TOML (not markdown):
 * required `name`, `description`, `developer_instructions` (multiline), with
 * optional `model`. The system prompt goes in `developer_instructions`.
 */
export function codexAgentToml(fields: {
  name: string;
  description: string;
  model?: string;
  developerInstructions: string;
}): string {
  const lines = [
    `name = "${tomlBasic(fields.name)}"`,
    `description = "${tomlBasic(fields.description)}"`,
  ];
  if (fields.model) lines.push(`model = "${tomlBasic(fields.model)}"`);
  // Multiline basic string. Escape backslashes and any """ that would terminate it.
  const body = fields.developerInstructions
    .replace(/\\/g, "\\\\")
    .replace(/"""/g, '\\"\\"\\"');
  lines.push(`developer_instructions = """\n${body.trimEnd()}\n"""`);
  return lines.join("\n") + "\n";
}

/**
 * Emit a command markdown file (`<dirPrefix>/<name>.md`) with the harness's
 * frontmatter and a body. The body is taken as-is; callers transform argument
 * tokens first where needed.
 */
export function emitCommandFile(
  name: string,
  frontmatter: Record<string, unknown>,
  body: string,
  dirPrefix: string,
): OutputFile {
  return {
    path: `${dirPrefix}/${name}.md`,
    content: renderFrontmatterDoc(frontmatter, body),
  };
}

/**
 * Wrap plugin instructions in id-keyed HTML-comment markers so the block can be
 * merged into a shared `AGENTS.md`/`CLAUDE.md` idempotently and coexist with
 * other plugins' blocks. The same wrapped content is used for both `build`
 * output and `install` merging.
 */
export function contextBlock(pluginId: string, instructions: string): string {
  const body = instructions.trim();
  return (
    `<!-- agent-plugin-sdk:${pluginId} START (managed — edit the plugin source, not here) -->\n` +
    `${body}\n` +
    `<!-- agent-plugin-sdk:${pluginId} END -->`
  );
}

/** Emit the harness's native context file containing the plugin's instruction block. */
export function emitContextFile(
  pluginId: string,
  instructions: string,
  fileName: string,
): OutputFile {
  return { path: fileName, content: contextBlock(pluginId, instructions) + "\n" };
}

/**
 * Rewrite portable 1-based positional argument tokens (`$1`, `$2`, …) to Claude
 * Code's 0-based explicit form (`$ARGUMENTS[0]`, `$ARGUMENTS[1]`, …).
 *
 * Claude treats `$1` as the *second* argument (0-based), while Codex/Pi/OpenCode
 * treat it as the first. Authors write 1-based; only Claude needs translation so
 * `$1` means "first argument" on every harness.
 *
 * `$ARGUMENTS`, escaped `\$1`, and `$$1` are left untouched.
 */
export function rewriteArgsToZeroBased(body: string): string {
  return body.replace(/(?<![\\\w$])\$([1-9]\d*)\b/g, (_m, digits: string) => {
    const n = Number.parseInt(digits, 10);
    return `$ARGUMENTS[${n - 1}]`;
  });
}
