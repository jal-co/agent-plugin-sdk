import { describe, expect, it } from "vitest";
import { build, PluginValidationError } from "../src/index.js";

function issues(fn: () => void): string[] {
  try {
    fn();
  } catch (err) {
    if (err instanceof PluginValidationError) return err.issues;
    throw err;
  }
  throw new Error("expected validation to throw");
}

describe("validation", () => {
  it("rejects a non-kebab plugin id", () => {
    const got = issues(() =>
      build({ id: "Git_Helper", description: "x" } as never),
    );
    expect(got.some((i) => i.includes("kebab-case"))).toBe(true);
  });

  it("collects multiple issues at once", () => {
    const got = issues(() =>
      build({
        id: "ok",
        description: "",
        skills: [
          { name: "Bad Name", description: "", instructions: "" },
        ],
      } as never),
    );
    expect(got.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects an over-long description (OpenCode 1024 limit)", () => {
    const got = issues(() =>
      build({
        id: "ok",
        description: "fine",
        skills: [
          {
            name: "big",
            description: "x".repeat(1025),
            instructions: "body",
          },
        ],
      } as never),
    );
    expect(got.some((i) => i.includes("1024"))).toBe(true);
  });

  it("rejects unsafe resource paths", () => {
    const got = issues(() =>
      build({
        id: "ok",
        description: "fine",
        skills: [
          {
            name: "x",
            description: "ok",
            instructions: "body",
            resources: [{ path: "../escape.md", content: "" }],
          },
        ],
      } as never),
    );
    expect(got.some((i) => i.includes("relative path"))).toBe(true);
  });

  it("rejects duplicate skill names", () => {
    const got = issues(() =>
      build({
        id: "ok",
        description: "fine",
        skills: [
          { name: "dup", description: "a", instructions: "b" },
          { name: "dup", description: "a", instructions: "b" },
        ],
      } as never),
    );
    expect(got.some((i) => i.includes("duplicate"))).toBe(true);
  });
});
