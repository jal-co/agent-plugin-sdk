"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { DocsNavGroup } from "@/lib/docs-nav";
import { cn } from "@/lib/utils";

function NavList({
  groups,
  pathname,
  onNavigate,
}: {
  groups: DocsNavGroup[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-6">
      {groups.map((group, i) => (
        <div
          key={group.title ?? `group-${i}`}
          className="flex flex-col gap-0.5"
        >
          {group.title ? (
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </p>
          ) : null}
          {group.items.map((item) => {
            const active = pathname === item.url;
            return (
              <Link
                key={item.url}
                href={item.url}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center rounded-lg px-3 py-2 text-sm leading-5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                  active
                    ? "bg-accent font-medium text-foreground shadow-sm"
                    : "text-foreground/70 hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <span className="truncate">{item.title}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Desktop: a floating card rail on the left. */
export function DocsSidebar({ groups }: { groups: DocsNavGroup[] }) {
  const pathname = usePathname();

  return (
    <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 pb-10">
      <NavList groups={groups} pathname={pathname} />
    </div>
  );
}

/** Mobile: a collapsible disclosure above the content. */
export function DocsMobileNav({ groups }: { groups: DocsNavGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const current =
    groups.flatMap((g) => g.items).find((i) => i.url === pathname)?.title ??
    "Documentation";

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="truncate">{current}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/60 p-3">
            <NavList
              groups={groups}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
