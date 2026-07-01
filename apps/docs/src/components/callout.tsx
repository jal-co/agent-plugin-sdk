import { cva, type VariantProps } from "class-variance-authority";
import { Info, Lightbulb, OctagonAlert, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * jalco-ui
 * Callout
 * by Justin Levine
 * ui.justinlevine.me
 *
 * MDX callout block for notes, tips, warnings, and danger states.
 * Server-safe and prose-isolated by the MDX component wrapper.
 */

const calloutVariants = cva(
  "rounded-xl border bg-card/70 p-4 text-sm leading-6 shadow-sm",
  {
    variants: {
      variant: {
        note: "border-blue-500/25 bg-blue-500/5 text-blue-950 dark:text-blue-100",
        tip: "border-emerald-500/25 bg-emerald-500/5 text-emerald-950 dark:text-emerald-100",
        warning:
          "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100",
        danger:
          "border-red-500/30 bg-red-500/10 text-red-950 dark:text-red-100",
      },
    },
    defaultVariants: { variant: "note" },
  },
);

const iconClass = {
  note: "text-blue-600 dark:text-blue-300",
  tip: "text-emerald-600 dark:text-emerald-300",
  warning: "text-amber-600 dark:text-amber-300",
  danger: "text-red-600 dark:text-red-300",
};

const icons = {
  note: Info,
  tip: Lightbulb,
  warning: TriangleAlert,
  danger: OctagonAlert,
};

export interface CalloutProps extends VariantProps<typeof calloutVariants> {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Callout({
  variant = "note",
  title,
  children,
  className,
}: CalloutProps) {
  const key = variant ?? "note";
  const Icon = icons[key];

  return (
    <aside className={cn(calloutVariants({ variant }), className)}>
      <div className="flex gap-3">
        <Icon className={cn("mt-0.5 size-4 shrink-0", iconClass[key])} />
        <div className="min-w-0 space-y-1">
          {title ? (
            <p className="font-medium text-foreground">{title}</p>
          ) : null}
          <div className="text-foreground/80 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
            {children}
          </div>
        </div>
      </div>
    </aside>
  );
}
