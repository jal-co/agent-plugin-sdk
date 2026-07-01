export type PluginChannel = "github" | "npm";

export interface PluginEntry {
  id: string;
  fullName: string | null;
  name: string;
  owner: string;
  avatarUrl: string | null;
  description: string | null;
  stars: number | null;
  updatedAt: string;
  repoUrl: string | null;
  npmName: string | null;
  npmVersion: string | null;
  channels: PluginChannel[];
  topics: string[];
}

interface GithubRepo {
  full_name: string;
  name: string;
  owner: { login: string; avatar_url: string };
  description: string | null;
  stargazers_count: number;
  pushed_at: string;
  html_url: string;
  topics?: string[];
  archived?: boolean;
  fork?: boolean;
}

interface NpmObject {
  package: {
    name: string;
    version: string;
    description?: string;
    date: string;
    links?: { repository?: string; npm?: string };
    publisher?: { username?: string };
  };
}

function normalizeRepo(url: string | undefined): string | null {
  if (!url) return null;
  const cleaned = url
    .replace(/^git\+/, "")
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/^git@github\.com:/, "")
    .replace(/\.git$/, "")
    .replace(/#.*$/, "")
    .replace(/\/$/, "");
  return /^[\w.-]+\/[\w.-]+$/.test(cleaned) ? cleaned.toLowerCase() : null;
}

async function fetchGithub(): Promise<GithubRepo[]> {
  const res = await fetch(
    "https://api.github.com/search/repositories?q=topic:ap-sdk-plugin&sort=stars&order=desc&per_page=100",
    {
      headers: {
        Accept: "application/vnd.github+json",
        ...(process.env.GIT_TOKEN
          ? { Authorization: `Bearer ${process.env.GIT_TOKEN}` }
          : {}),
      },
      next: { revalidate: 3600 },
    },
  );
  if (!res.ok) throw new Error(`GitHub search failed: ${res.status}`);
  const json = (await res.json()) as { items?: GithubRepo[] };
  return (json.items ?? []).filter((repo) => !repo.archived && !repo.fork);
}

async function fetchNpm(): Promise<NpmObject[]> {
  const res = await fetch(
    "https://registry.npmjs.org/-/v1/search?text=keywords:ap-sdk-plugin&size=250",
    { next: { revalidate: 3600 } },
  );
  if (!res.ok) throw new Error(`npm search failed: ${res.status}`);
  const json = (await res.json()) as { objects?: NpmObject[] };
  return json.objects ?? [];
}

export async function fetchPluginEntries(): Promise<PluginEntry[] | null> {
  const [githubResult, npmResult] = await Promise.allSettled([
    fetchGithub(),
    fetchNpm(),
  ]);

  if (githubResult.status === "rejected" && npmResult.status === "rejected") {
    console.warn(githubResult.reason, npmResult.reason);
    return null;
  }
  if (githubResult.status === "rejected") console.warn(githubResult.reason);
  if (npmResult.status === "rejected") console.warn(npmResult.reason);

  const entries = new Map<string, PluginEntry>();
  for (const repo of githubResult.status === "fulfilled"
    ? githubResult.value
    : []) {
    entries.set(repo.full_name.toLowerCase(), {
      id: repo.full_name,
      fullName: repo.full_name,
      name: repo.name,
      owner: repo.owner.login,
      avatarUrl: repo.owner.avatar_url,
      description: repo.description,
      stars: repo.stargazers_count,
      updatedAt: repo.pushed_at,
      repoUrl: repo.html_url,
      npmName: null,
      npmVersion: null,
      channels: ["github"],
      topics: repo.topics ?? [],
    });
  }

  for (const obj of npmResult.status === "fulfilled" ? npmResult.value : []) {
    const pkg = obj.package;
    const repoKey = normalizeRepo(pkg.links?.repository);
    const existing = repoKey ? entries.get(repoKey) : undefined;
    if (existing) {
      existing.npmName = pkg.name;
      existing.npmVersion = pkg.version;
      if (!existing.channels.includes("npm")) existing.channels.push("npm");
    } else {
      entries.set(`npm:${pkg.name}`, {
        id: pkg.name,
        fullName: repoKey,
        name: pkg.name,
        owner: pkg.publisher?.username ?? "npm",
        avatarUrl: null,
        description: pkg.description ?? null,
        stars: null,
        updatedAt: pkg.date,
        repoUrl: repoKey ? `https://github.com/${repoKey}` : null,
        npmName: pkg.name,
        npmVersion: pkg.version,
        channels: ["npm"],
        topics: [],
      });
    }
  }

  return [...entries.values()].sort(
    (a, b) => (b.stars ?? -1) - (a.stars ?? -1),
  );
}
