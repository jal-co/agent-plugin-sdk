import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";
import { x as tarExtract } from "tar";
import { DEFAULT_PLUGIN_FILES, locatePlugin } from "./plugin-files.js";

export interface GithubSpec {
  owner: string;
  repo: string;
  /** Branch, tag, or commit. Defaults to the repository's default branch. */
  ref?: string;
}

/**
 * Parse a GitHub source into `{ owner, repo, ref }`. Accepts:
 * - `owner/repo` and `owner/repo#ref`
 * - `github:owner/repo[#ref]`
 * - `https://github.com/owner/repo[/tree/ref][#ref]`
 */
export function parseGithubSpec(spec: string): GithubSpec | null {
  const s = spec.trim().replace(/^github:/i, "");

  const url = s.match(
    /^https?:\/\/github\.com\/([\w-]+)\/([^/#]+?)(?:\.git)?(?:\/tree\/([^/#]+))?(?:#(.+))?$/i,
  );
  if (url) {
    const [, owner, repo, treeRef, hashRef] = url;
    return { owner: owner!, repo: repo!, ref: hashRef || treeRef || undefined };
  }

  const short = s.match(/^([\w-]+)\/([\w.-]+?)(?:\.git)?(?:#(.+))?$/);
  if (short) {
    const [, owner, repo, ref] = short;
    return { owner: owner!, repo: repo!, ref: ref || undefined };
  }

  return null;
}

/**
 * Whether `spec` looks like a GitHub source rather than a local path. Bare
 * `owner/repo` only counts when it isn't an existing local path and doesn't end
 * in a JS/TS file extension (so `dir/plugin.ts` stays a local path).
 */
export function isGithubSpec(spec: string): boolean {
  if (/^github:/i.test(spec) || /^https?:\/\/github\.com\//i.test(spec)) {
    return true;
  }
  const base = spec.split("#")[0] ?? spec;
  return (
    /^[\w.-]+\/[\w.-]+(?:#.+)?$/.test(spec) &&
    !/\.(ts|js|mjs|cjs|json)$/i.test(base) &&
    !existsSync(base)
  );
}

export interface FetchedPlugin {
  spec: GithubSpec;
  /** Absolute path to the plugin file inside the extracted repo. */
  pluginPath: string;
  /** A human label like `owner/repo#ref`. */
  label: string;
  /** Remove the temporary checkout. Always call this when done. */
  cleanup: () => void;
}

/**
 * Download a GitHub repo's tarball, extract it to a temp dir, link the running
 * `@jalco/ap-sdk` package in so the plugin's import resolves, and locate its
 * plugin file. Throws with a clear message if the repo, ref, or plugin file
 * can't be found.
 */
export async function fetchGithubPlugin(
  rawSpec: string,
  opts: { path?: string } = {},
): Promise<FetchedPlugin> {
  const spec = parseGithubSpec(rawSpec);
  if (!spec) {
    throw new Error(
      `Not a GitHub source: "${rawSpec}". Use owner/repo, github:owner/repo, or a github.com URL.`,
    );
  }
  const label = `${spec.owner}/${spec.repo}${spec.ref ? `#${spec.ref}` : ""}`;
  const dir = mkdtempSync(join(tmpdir(), "ap-sdk-gh-"));
  let ok = false;
  try {
    await downloadAndExtract(spec, label, dir);
    linkSdk(dir);

    const root = opts.path ? join(dir, opts.path) : dir;
    const pluginPath = locatePlugin(root);
    if (!pluginPath) {
      const where = opts.path ? `${label}/${opts.path}` : label;
      throw new Error(
        `No ap-sdk plugin file found in ${where} (looked for ${DEFAULT_PLUGIN_FILES.join(", ")}).` +
          (opts.path
            ? ""
            : " If it lives in a subdirectory, pass --path <dir>."),
      );
    }

    ok = true;
    return {
      spec,
      pluginPath,
      label,
      cleanup: () => rmSync(dir, { recursive: true, force: true }),
    };
  } finally {
    if (!ok) rmSync(dir, { recursive: true, force: true });
  }
}

async function downloadAndExtract(
  spec: GithubSpec,
  label: string,
  dir: string,
): Promise<void> {
  const ref = spec.ref ? `/${encodeURIComponent(spec.ref)}` : "";
  const url = `https://api.github.com/repos/${spec.owner}/${spec.repo}/tarball${ref}`;
  const token = process.env.GITHUB_TOKEN || process.env.GIT_TOKEN;

  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "ap-sdk-cli",
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok || !res.body) {
    const hint =
      res.status === 404
        ? " (repository or ref not found — if it's private, set GITHUB_TOKEN)"
        : res.status === 403
          ? " (rate limited — set GITHUB_TOKEN for a higher limit)"
          : "";
    throw new Error(
      `Failed to download ${label}: ${res.status} ${res.statusText}${hint}`,
    );
  }

  // GitHub tarballs nest everything under one `owner-repo-sha/` dir — strip it.
  await pipeline(
    Readable.fromWeb(res.body as WebReadableStream<Uint8Array>),
    createGunzip(),
    tarExtract({ cwd: dir, strip: 1 }),
  );
}

/**
 * Symlink the running `@jalco/ap-sdk` package into the extracted repo's
 * `node_modules`, so the plugin's `import { ... } from "@jalco/ap-sdk"` resolves
 * to the same SDK that's performing the install/check.
 */
function linkSdk(dir: string): void {
  const root = findSdkRoot();
  const scope = join(dir, "node_modules", "@jalco");
  mkdirSync(scope, { recursive: true });
  symlinkSync(root, join(scope, "ap-sdk"), "junction");
}

/** Walk up from this module to the `@jalco/ap-sdk` package root. */
function findSdkRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const pj = join(dir, "package.json");
    if (existsSync(pj)) {
      try {
        if (JSON.parse(readFileSync(pj, "utf8")).name === "@jalco/ap-sdk") {
          return dir;
        }
      } catch {
        // keep walking up
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate the @jalco/ap-sdk package root.");
}
