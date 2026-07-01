"use client";

import {
  AnchorProvider,
  ScrollProvider,
  TOCItem,
  type TOCItemType,
} from "fumadocs-core/toc";
import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Table of contents with active-anchor tracking (scrollspy). */
export function DocsToc({ items }: { items: TOCItemType[] }) {
  const viewRef = useRef<HTMLDivElement>(null);

  if (!items.length) return null;

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        On this page
      </p>
      <AnchorProvider toc={items}>
        <div ref={viewRef} className="max-h-[60vh] overflow-auto">
          <ScrollProvider containerRef={viewRef}>
            <div className="flex flex-col border-l border-border/50">
              {items.map((item) => (
                <TOCItem
                  key={item.url}
                  href={item.url}
                  className={cn(
                    "-ml-px border-l-2 border-transparent py-1 text-sm leading-5 text-muted-foreground transition-colors",
                    "line-clamp-2 hover:text-foreground",
                    "data-[active=true]:border-primary data-[active=true]:font-medium data-[active=true]:text-foreground",
                  )}
                  style={{ paddingLeft: 12 + (item.depth - 2) * 12 }}
                >
                  {item.title}
                </TOCItem>
              ))}
            </div>
          </ScrollProvider>
        </div>
      </AnchorProvider>
    </div>
  );
}

/** Mobile: collapsible page-local table of contents. */
export function MobileDocsToc({ items }: { items: TOCItemType[] }) {
  const [open, setOpen] = useState(false);

  if (!items.length) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span>On this page</span>
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
          <div className="border-t border-border/60 p-4">
            <DocsToc items={items} />
          </div>
        </div>
      </div>
    </div>
  );
}
