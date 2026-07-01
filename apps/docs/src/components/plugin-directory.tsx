"use client";

import { Check, Copy, Star } from "lucide-react";
import { useMemo, useState } from "react";
import type { PluginChannel, PluginEntry } from "@/lib/github-plugins";

const NPM_INSTALL_SUPPORTED = true;

function relativeTime(value: string): string {
  const diff = new Date(value).getTime() - Date.now();
  const days = Math.round(diff / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(days) < 1) return "today";
  if (Math.abs(days) < 60) return rtf.format(days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 24) return rtf.format(months, "month");
  return rtf.format(Math.round(days / 365), "year");
}

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(command);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-left font-mono text-xs text-foreground transition-colors hover:bg-accent/50"
    >
      <span className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
        {command}
      </span>
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function ChannelBadge({ channel }: { channel: PluginChannel }) {
  return (
    <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {channel === "github" ? "git" : "npm"}
    </span>
  );
}

function PluginCard({ entry }: { entry: PluginEntry }) {
  const href =
    entry.repoUrl ?? `https://www.npmjs.com/package/${entry.npmName}`;
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm transition-colors hover:bg-accent/30">
      <div className="flex items-start gap-3">
        {entry.avatarUrl ? (
          // GitHub avatar domains are dynamic; keep this tiny decorative image unoptimized.
          // biome-ignore lint/performance/noImgElement: external avatar URL from registry data
          <img
            src={entry.avatarUrl}
            alt=""
            className="mt-0.5 size-6 rounded-full"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground transition-colors hover:text-primary"
          >
            {entry.name}
          </a>
          <p className="text-xs text-muted-foreground">{entry.owner}</p>
        </div>
        {entry.stars !== null ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3.5" /> {entry.stars}
          </span>
        ) : null}
      </div>
      <p className="line-clamp-3 min-h-12 text-sm text-muted-foreground">
        {entry.description ?? "No description provided."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {entry.channels.map((channel) => (
          <ChannelBadge key={channel} channel={channel} />
        ))}
        <span className="text-xs text-muted-foreground">
          updated {relativeTime(entry.updatedAt)}
        </span>
        {entry.topics
          .filter((t) => t !== "ap-sdk-plugin")
          .slice(0, 3)
          .map((topic) => (
            <span
              key={topic}
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {topic}
            </span>
          ))}
      </div>
      <div className="mt-auto flex flex-col gap-2">
        {entry.fullName && entry.channels.includes("github") ? (
          <CopyCommand command={`npx ap-sdk install ${entry.fullName}`} />
        ) : null}
        {entry.npmName ? (
          NPM_INSTALL_SUPPORTED ? (
            <CopyCommand command={`npx ap-sdk install npm:${entry.npmName}`} />
          ) : (
            <a
              href={`https://www.npmjs.com/package/${entry.npmName}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              View npm package
            </a>
          )
        ) : null}
      </div>
    </article>
  );
}

export function PluginDirectory({
  entries,
  degraded,
}: {
  entries: PluginEntry[];
  degraded: boolean;
}) {
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<"all" | PluginChannel>("all");
  const [sort, setSort] = useState<"stars" | "recent" | "az">("stars");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return entries
      .filter((entry) => channel === "all" || entry.channels.includes(channel))
      .filter(
        (entry) =>
          !q ||
          [entry.name, entry.description ?? "", entry.owner].some((v) =>
            v.toLowerCase().includes(q),
          ),
      )
      .sort((a, b) => {
        if (sort === "az") return a.name.localeCompare(b.name);
        if (sort === "recent")
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        return (b.stars ?? -1) - (a.stars ?? -1);
      });
  }, [channel, entries, query, sort]);

  if (degraded) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
        Couldn't reach GitHub or npm right now. Browse the{" "}
        <a
          href="https://github.com/topics/ap-sdk-plugin"
          className="text-foreground underline"
          target="_blank"
          rel="noreferrer"
        >
          ap-sdk-plugin topic
        </a>{" "}
        directly.
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">
          No plugins tagged yet
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Be the first: tag your repo with <code>ap-sdk-plugin</code> or publish
          an npm package with that keyword.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-3 sm:flex-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by name, description, or author"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <select
          value={channel}
          onChange={(event) => setChannel(event.target.value as typeof channel)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="all">All channels</option>
          <option value="github">GitHub</option>
          <option value="npm">npm</option>
        </select>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as typeof sort)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="stars">Stars</option>
          <option value="recent">Recently updated</option>
          <option value="az">A–Z</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
          No plugins match “{query}”.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((entry) => (
            <PluginCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
