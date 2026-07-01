"use client";

import { useDocsSearch } from "fumadocs-core/search/client";
import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * jalco-ui
 * SearchDialog
 * by Justin Levine
 * ui.justinlevine.me
 *
 * Hand-rolled docs search UI powered by fumadocs-core's search client.
 */

interface SearchResult {
  id: string;
  url: string;
  type: "page" | "heading" | "text";
  content: string;
  breadcrumbs?: string[];
}

function plain(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resultTitle(result: SearchResult): string {
  const crumbs = result.breadcrumbs?.map(plain).filter(Boolean) ?? [];
  if (crumbs.length) return crumbs.join(" / ");
  return plain(result.content) || result.url;
}

export function SearchTrigger({
  onClick,
  mobile = false,
}: {
  onClick: () => void;
  mobile?: boolean;
}) {
  if (mobile) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Search docs"
        onClick={onClick}
      >
        <Search className="size-4" />
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden min-w-40 items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:flex"
    >
      <span className="inline-flex items-center gap-2">
        <Search className="size-4" />
        Search docs…
      </span>
      <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        ⌘K
      </kbd>
    </button>
  );
}

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);
  const { search, setSearch, query } = useDocsSearch({
    type: "fetch",
    api: "/api/search",
    delayMs: 80,
  });

  const results = useMemo(
    () => (Array.isArray(query.data) ? (query.data as SearchResult[]) : []),
    [query.data],
  );

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const go = (result: SearchResult | undefined) => {
    if (!result) return;
    window.location.href = result.url;
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-background/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-24 z-[81] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl outline-none">
          <Dialog.Title className="sr-only">Search documentation</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((i) => Math.min(results.length - 1, i + 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((i) => Math.max(0, i - 1));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  go(results[active]);
                }
              }}
              placeholder="Search docs…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <Dialog.Close className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              Esc
            </Dialog.Close>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {!search ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Type a keyword, command, or harness name.
              </p>
            ) : query.isLoading ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Searching…
              </p>
            ) : query.error ? (
              <p className="px-3 py-8 text-center text-sm text-destructive">
                Search failed. Try again.
              </p>
            ) : results.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No results for “{search}”.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {results.map((result, index) => (
                  <Link
                    key={result.id}
                    href={result.url}
                    onClick={() => onOpenChange(false)}
                    onMouseEnter={() => setActive(index)}
                    className={cn(
                      "rounded-xl px-3 py-2 text-sm outline-none transition-colors",
                      index === active
                        ? "bg-accent text-foreground"
                        : "text-foreground hover:bg-accent/60",
                    )}
                  >
                    <span className="block font-medium">
                      {resultTitle(result)}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">
                      {plain(result.content)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function DocsSearch() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (pathname) setOpen(false);
  }, [pathname]);

  return (
    <>
      <SearchTrigger onClick={() => setOpen(true)} />
      <div className="sm:hidden">
        <SearchTrigger mobile onClick={() => setOpen(true)} />
      </div>
      <SearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
