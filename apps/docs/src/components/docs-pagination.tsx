import Link from "next/link";
import { getDocsNavFlat } from "@/lib/docs-nav";
import { cn } from "@/lib/utils";

function PaginationCard({
  href,
  label,
  title,
  align = "left",
}: {
  href: string;
  label: string;
  title: string;
  align?: "left" | "right";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-24 flex-col justify-center rounded-xl border border-border/60 bg-card/40 p-4 no-underline transition-colors hover:bg-accent/50",
        align === "right" && "items-end text-right",
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 text-sm font-medium text-foreground">{title}</span>
    </Link>
  );
}

export function DocsPagination({ current }: { current: string }) {
  const items = getDocsNavFlat();
  const index = items.findIndex((item) => item.url === current);
  if (index === -1) return null;

  const previous = items[index - 1];
  const next = items[index + 1];
  if (!previous && !next) return null;

  return (
    <nav
      aria-label="Documentation pagination"
      className="mt-12 grid gap-3 border-t border-border/60 pt-8 sm:grid-cols-2"
    >
      {previous ? (
        <PaginationCard
          href={previous.url}
          label="← Previous"
          title={previous.title}
        />
      ) : (
        <div />
      )}
      {next ? (
        <PaginationCard
          href={next.url}
          label="Next →"
          title={next.title}
          align="right"
        />
      ) : null}
    </nav>
  );
}
