import { describe, expect, it } from "vitest";
import { isGithubSpec, parseGithubSpec } from "../src/github.js";

describe("parseGithubSpec", () => {
  it("parses owner/repo", () => {
    expect(parseGithubSpec("acme/plugin")).toEqual({
      owner: "acme",
      repo: "plugin",
      ref: undefined,
    });
  });

  it("parses owner/repo#ref", () => {
    expect(parseGithubSpec("acme/plugin#v1.2.0")).toEqual({
      owner: "acme",
      repo: "plugin",
      ref: "v1.2.0",
    });
  });

  it("strips the github: prefix and a .git suffix", () => {
    expect(parseGithubSpec("github:acme/plugin.git")).toEqual({
      owner: "acme",
      repo: "plugin",
      ref: undefined,
    });
  });

  it("parses full URLs, including /tree/<ref>", () => {
    expect(parseGithubSpec("https://github.com/acme/plugin")).toEqual({
      owner: "acme",
      repo: "plugin",
      ref: undefined,
    });
    expect(parseGithubSpec("https://github.com/acme/plugin/tree/next")).toEqual({
      owner: "acme",
      repo: "plugin",
      ref: "next",
    });
  });

  it("prefers an explicit #ref over /tree/<ref>", () => {
    expect(
      parseGithubSpec("https://github.com/acme/plugin/tree/next#beta"),
    ).toEqual({ owner: "acme", repo: "plugin", ref: "beta" });
  });

  it("returns null for non-GitHub strings", () => {
    expect(parseGithubSpec("./plugin.ts")).toBeNull();
    expect(parseGithubSpec("not a spec")).toBeNull();
  });
});

describe("isGithubSpec", () => {
  it("accepts explicit github: specs and github.com URLs", () => {
    expect(isGithubSpec("github:acme/plugin")).toBe(true);
    expect(isGithubSpec("https://github.com/acme/plugin")).toBe(true);
  });

  it("accepts bare owner/repo (with optional #ref)", () => {
    expect(isGithubSpec("acme/plugin")).toBe(true);
    expect(isGithubSpec("acme/plugin#main")).toBe(true);
  });

  it("rejects local file paths", () => {
    expect(isGithubSpec("./plugin.ts")).toBe(false);
    expect(isGithubSpec("dir/plugin.ts")).toBe(false);
    expect(isGithubSpec("plugin.ts")).toBe(false);
    expect(isGithubSpec("/abs/path/plugin.ts")).toBe(false);
  });
});
