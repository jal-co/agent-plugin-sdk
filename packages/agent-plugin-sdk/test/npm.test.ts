import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { c as tarCreate } from "tar";
import { fetchNpmPlugin, isNpmSpec, parseNpmSpec } from "../src/npm.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseNpmSpec", () => {
  it("parses package specs", () => {
    expect(parseNpmSpec("npm:foo")).toEqual({ name: "foo", version: undefined });
    expect(parseNpmSpec("npm:foo@1.2.3")).toEqual({ name: "foo", version: "1.2.3" });
    expect(parseNpmSpec("npm:@scope/foo")).toEqual({ name: "@scope/foo", version: undefined });
    expect(parseNpmSpec("npm:@scope/foo@next")).toEqual({ name: "@scope/foo", version: "next" });
  });

  it("rejects empty or invalid names", () => {
    expect(parseNpmSpec("npm:")).toBeNull();
    expect(parseNpmSpec("npm:Bad_Name")).toBeNull();
  });
});

describe("isNpmSpec", () => {
  it("is a strict prefix check", () => {
    expect(isNpmSpec("npm:foo")).toBe(true);
    expect(isNpmSpec("./npm:weird")).toBe(false);
    expect(isNpmSpec("owner/repo")).toBe(false);
  });
});

describe("fetchNpmPlugin", () => {
  it("extracts a package and locates the plugin", async () => {
    const tarball = await packageTar({ "plugin.ts": "export default { id: 'pkg', description: 'd' };\n" });
    stubNpmFetch(tarball);

    const fetched = await fetchNpmPlugin("npm:pkg");

    expect(fetched.label).toBe("npm:pkg@1.2.3");
    expect(readFileSync(fetched.pluginPath, "utf8")).toContain("id: 'pkg'");
    const dir = fetched.pluginPath.split("/package/")[0] ?? fetched.pluginPath;
    fetched.cleanup();
    expect(existsSync(fetched.pluginPath)).toBe(false);
    expect(existsSync(dir)).toBe(false);
  });

  it("rejects registry 404s with the package name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("missing", { status: 404, statusText: "Not Found" })),
    );

    await expect(fetchNpmPlugin("npm:missing-pkg")).rejects.toThrow(/missing-pkg/);
  });

  it("prefers package.json ap-sdk.plugin over conventional files", async () => {
    const tarball = await packageTar({
      "package.json": JSON.stringify({ "ap-sdk": { plugin: "./custom/entry.ts" } }),
      "plugin.ts": "export default { id: 'root', description: 'd' };\n",
      "custom/entry.ts": "export default { id: 'custom', description: 'd' };\n",
    });
    stubNpmFetch(tarball);

    const fetched = await fetchNpmPlugin("npm:pkg");

    expect(fetched.pluginPath.endsWith("custom/entry.ts")).toBe(true);
    expect(readFileSync(fetched.pluginPath, "utf8")).toContain("custom");
    fetched.cleanup();
  });
});

async function packageTar(files: Record<string, string>): Promise<Buffer> {
  const dir = mkdtempSync(join(tmpdir(), "aps-npm-fixture-"));
  const archive = join(dir, "pkg.tgz");
  try {
    for (const [name, content] of Object.entries(files)) {
      const file = join(dir, "package", name);
      await import("node:fs/promises").then(async (fs) => {
        await fs.mkdir(dirname(file), { recursive: true });
        await fs.writeFile(file, content);
      });
    }
    await tarCreate({ cwd: dir, gzip: true, file: archive }, ["package"]);
    return readFileSync(archive);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function stubNpmFetch(tarball: Buffer): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("registry.npmjs.org")) {
        return new Response(
          JSON.stringify({ name: "pkg", version: "1.2.3", dist: { tarball: "https://registry.example/pkg.tgz" } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(tarball, { status: 200 });
    }),
  );
}
