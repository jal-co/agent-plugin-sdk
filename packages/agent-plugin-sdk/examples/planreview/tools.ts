// The shared tool logic for the `planreview` plugin — written ONCE.
//
// The SDK compiles these handlers into an MCP server (Claude/Codex), a Pi
// extension, and an OpenCode plugin. They are plain Node + the SDK runtime, so
// the build copies this file into each harness output and the glue imports it.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineTool, text, json, error } from "agent-plugin-sdk/runtime";

/** Run `git diff` (optionally staged) in the working dir and return it. */
const reviewDiff = defineTool<{ staged?: boolean }>({
  name: "review_diff",
  description:
    "Capture the current git diff for review. Use before opening a PR or when the user asks what changed.",
  parameters: {
    type: "object",
    properties: {
      staged: { type: "boolean", description: "Only the staged diff." },
    },
  },
  execute({ staged }, ctx) {
    try {
      const args = ["diff", ...(staged ? ["--staged"] : []), "--stat"];
      const out = execFileSync("git", args, {
        cwd: ctx.cwd ?? process.cwd(),
        encoding: "utf8",
      }).trim();
      return out
        ? text(`Changes to review:\n\n${out}`)
        : text("No changes to review — the working tree is clean.");
    } catch (err) {
      return error(`Could not read the git diff: ${(err as Error).message}`);
    }
  },
});

/** Read a file and return its contents wrapped with annotation instructions. */
const annotateFile = defineTool<{ path: string }>({
  name: "annotate_file",
  description:
    "Load a markdown or text file for annotation. Returns its contents so you can mark it up and propose edits.",
  parameters: {
    type: "object",
    properties: { path: { type: "string", description: "File path to annotate." } },
    required: ["path"],
  },
  execute({ path }) {
    try {
      const body = readFileSync(path, "utf8");
      return json({
        path,
        lineCount: body.split("\n").length,
        contents: body,
        instructions:
          "Review the contents above, then propose specific, line-referenced annotations.",
      });
    } catch (err) {
      return error(`Could not read ${path}: ${(err as Error).message}`);
    }
  },
});

export default [reviewDiff, annotateFile];
