"use client";

import { Tabs as RadixTabs } from "radix-ui";
import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { cn } from "@/lib/utils";

/**
 * jalco-ui
 * Tabs
 * by Justin Levine
 * ui.justinlevine.me
 *
 * MDX-friendly tab set with optional localStorage persistence.
 */

export interface TabsProps {
  items: string[];
  storageKey?: string;
  children: ReactNode;
  className?: string;
}

export interface TabProps extends ComponentProps<"div"> {
  children: ReactNode;
}

export function Tab({ className, ...props }: TabProps) {
  return <div className={cn("min-w-0", className)} {...props} />;
}

export function Tabs({ items, storageKey, children, className }: TabsProps) {
  const id = useId();
  const values = useMemo(
    () =>
      items.map(
        (item, index) =>
          `${index}-${item.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      ),
    [items],
  );
  const [value, setValue] = useState(values[0] ?? "0-tab");

  useEffect(() => {
    if (!storageKey) return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored && values.includes(stored)) setValue(stored);
  }, [storageKey, values]);

  useEffect(() => {
    if (!storageKey) return;
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === storageKey &&
        event.newValue &&
        values.includes(event.newValue)
      ) {
        setValue(event.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey, values]);

  const onValueChange = (next: string) => {
    setValue(next);
    if (storageKey) window.localStorage.setItem(storageKey, next);
  };

  const panels = Children.toArray(children).filter(isValidElement);

  return (
    <RadixTabs.Root
      value={value}
      onValueChange={onValueChange}
      className={cn("rounded-xl border border-border/60 bg-card/40", className)}
    >
      <RadixTabs.List
        aria-label="Content tabs"
        className="flex gap-1 overflow-x-auto border-b border-border/60 px-2 pt-2"
      >
        {items.map((item, index) => {
          const tabValue = values[index] ?? `${index}-${item}`;
          return (
            <RadixTabs.Trigger
              key={`${id}-${tabValue}`}
              value={tabValue}
              className={cn(
                "rounded-t-lg px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors",
                "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
                "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
              )}
            >
              {item}
            </RadixTabs.Trigger>
          );
        })}
      </RadixTabs.List>
      {values.map((tabValue, index) => (
        <RadixTabs.Content
          key={tabValue}
          value={tabValue}
          className="min-w-0 p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {panels[index] ?? null}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
