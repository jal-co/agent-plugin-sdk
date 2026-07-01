import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { readText, readTextFrom } from "../src/util/read.js";

describe("readText", () => {
  const dir = mkdtempSync(join(tmpdir(), "ap-read-"));
  writeFileSync(join(dir, "a.md"), "hello world");
  const fileBase = pathToFileURL(join(dir, "plugin.ts")).href;

  it("reads an absolute path", () => {
    expect(readText(join(dir, "a.md"))).toBe("hello world");
  });

  it("resolves relative to a file: base (import.meta.url style)", () => {
    expect(readText("./a.md", fileBase)).toBe("hello world");
  });

  it("resolves relative to a directory base", () => {
    expect(readText("a.md", dir)).toBe("hello world");
  });

  it("readTextFrom binds a base for repeated reads", () => {
    const read = readTextFrom(fileBase);
    expect(read("./a.md")).toBe("hello world");
  });
});
