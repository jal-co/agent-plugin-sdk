import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";
import { x as tarExtract } from "tar";
import { DEFAULT_PLUGIN_FILES, locatePlugin } from "./plugin-files.js";

export interface NpmSpec {
  name: string;
  /** Exact version or dist-tag. Defaults to latest. */
  version?: string;
}

export interface FetchedNpmPlugin {
  spec: NpmSpec;
  pluginPath: string;
  label: string;
  cleanup: () => void;
}

const NPM_NAME = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

export function parseNpmSpec(spec: string): NpmSpec | null {
  if (!/^npm:/i.test(spec)) return null;
  const body = spec.slice(4).trim();
  if (!body) return null;
  const at = body.lastIndexOf("@");
  const hasVersion = at > 0;
  const name = hasVersion ? body.slice(0, at) : body;
  const version = hasVersion ? body.slice(at + 1) : undefined;
  if (!name || !NPM_NAME.test(name) || version === "") return null;
  return { name, version };
}

export function isNpmSpec(spec: string): boolean {
  return /^npm:/i.test(spec);
}

export async function fetchNpmPlugin(
  rawSpec: string,
  opts: { path?: string } = {},
): Promise<FetchedNpmPlugin> {
  const spec = parseNpmSpec(rawSpec);
  if (!spec) {
    throw new Error(
      `Not an npm source: "${rawSpec}". Use npm:<package> or npm:<package>@<version>.`,
    );
  }

  const dir = mkdtempSync(join(tmpdir(), "ap-sdk-npm-"));
  let ok = false;
  try {
    const doc = await fetchVersionDoc(spec);
    await downloadAndExtract(doc.dist.tarball, `${spec.name}@${doc.version}`, dir);
    linkSdk(dir);

    const root = opts.path ? join(dir, opts.path) : dir;
    const pluginPath = findPackagePlugin(root);
    if (!pluginPath) {
      const where = opts.path ? `npm:${spec.name}/${opts.path}` : `npm:${spec.name}`;
      throw new Error(
        `No ap-sdk plugin file found in ${where} (looked for ${DEFAULT_PLUGIN_FILES.join(", ")}).` +
          (opts.path
            ? ""
            : " If it lives in a subdirectory, pass --path <dir>. Packages can also set \"ap-sdk\": { \"plugin\": \"./plugin.ts\" } in package.json."),
      );
    }

    ok = true;
    return {
      spec,
      pluginPath,
      label: `npm:${spec.name}@${doc.version}`,
      cleanup: () => rmSync(dir, { recursive: true, force: true }),
    };
  } finally {
    if (!ok) rmSync(dir, { recursive: true, force: true });
  }
}

interface NpmVersionDoc {
  name: string;
  version: string;
  dist: { tarball: string };
}

async function fetchVersionDoc(spec: NpmSpec): Promise<NpmVersionDoc> {
  const version = spec.version ?? "latest";
  const url = `https://registry.npmjs.org/${encodeURIComponent(spec.name)}/${encodeURIComponent(version)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "ap-sdk-cli", Accept: "application/json" },
  });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        spec.version
          ? `npm package "${spec.name}" version/tag "${spec.version}" not found`
          : `npm package "${spec.name}" not found`,
      );
    }
    throw new Error(`Failed to fetch npm package "${spec.name}": ${res.status} ${res.statusText}`);
  }
  const doc = (await res.json()) as Partial<NpmVersionDoc>;
  if (!doc.version || !doc.dist?.tarball) {
    throw new Error(`npm package "${spec.name}" did not include a tarball URL`);
  }
  return doc as NpmVersionDoc;
}

async function downloadAndExtract(url: string, label: string, dir: string): Promise<void> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "ap-sdk-cli" },
  });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${label}: ${res.status} ${res.statusText}`);
  }
  await pipeline(
    Readable.fromWeb(res.body as WebReadableStream<Uint8Array>),
    createGunzip(),
    tarExtract({ cwd: dir, strip: 1 }),
  );
}

function findPackagePlugin(root: string): string | null {
  const manifest = join(root, "package.json");
  if (existsSync(manifest)) {
    try {
      const pkg = JSON.parse(readFileSync(manifest, "utf8")) as {
        "ap-sdk"?: { plugin?: string };
      };
      const plugin = pkg["ap-sdk"]?.plugin;
      if (typeof plugin === "string" && plugin.trim()) {
        const target = resolve(root, plugin);
        if (existsSync(target)) return target;
      }
    } catch {
      // Fall back to conventional filenames.
    }
  }
  return locatePlugin(root);
}

function linkSdk(dir: string): void {
  const root = findSdkRoot();
  const scope = join(dir, "node_modules", "@jalco");
  mkdirSync(scope, { recursive: true });
  symlinkSync(root, join(scope, "ap-sdk"), "junction");
}

function findSdkRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const pj = join(dir, "package.json");
    if (existsSync(pj)) {
      try {
        if (JSON.parse(readFileSync(pj, "utf8")).name === "@jalco/ap-sdk") return dir;
      } catch {
        // keep walking
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate the @jalco/ap-sdk package root.");
}
