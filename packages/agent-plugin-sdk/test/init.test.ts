import { describe, expect, it } from "vitest";
import { defineCommand, definePlugin, defineSkill } from "../src/index.js";
import { validatePlugin } from "../src/validate.js";
import { pluginTemplate, validatePluginId } from "../src/scaffold-plugin.js";

describe("ap-sdk init scaffold", () => {
  it("renders a starter plugin importing the public package", () => {
    const src = pluginTemplate("my-plugin");
    expect(src).toContain("definePlugin");
    expect(src).toContain('id: "my-plugin"');
    expect(src).toContain('from "@jalco/ap-sdk"');
  });

  it("matches a plugin shape that validates", () => {
    const plugin = definePlugin({
      id: "my-plugin",
      description: "Helpers for working with git in a repo.",
      instructions: "## Git\n- Branch off main; never commit to it directly.",
      skills: [
        defineSkill({
          name: "diff-review",
          description:
            "Summarize and risk-flag uncommitted changes. Use when the user asks what changed.",
          instructions: "Run `git diff HEAD` and summarize the changes in 2-4 bullets.",
        }),
      ],
      commands: [
        defineCommand({
          name: "commit",
          description: "Write a conventional commit for the staged changes.",
          body: "Write a Conventional Commit message for the staged diff. Args: $ARGUMENTS",
        }),
      ],
    });

    expect(() => validatePlugin(plugin)).not.toThrow();
    const src = pluginTemplate("my-plugin");
    expect(src).toContain('instructions: "## Git\\n- Branch off main; never commit to it directly."');
    expect(src).toContain('name: "diff-review"');
    expect(src).toContain('name: "commit"');
  });

  it("validates kebab-case plugin ids", () => {
    expect(validatePluginId("my-plugin")).toBeNull();
    expect(validatePluginId("My_Plugin")).toMatch(/kebab-case/);
  });
});
