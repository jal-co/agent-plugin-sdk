"use client";

import {
  AnchorProvider,
  ScrollProvider,
  TOCItem,
  type TOCItemType,
} from "fumadocs-core/toc";
import { useRef } from "react";
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
