"use client";

/* ─────────────────────────────────────────────────────────
 * SCROLL STORYBOARD — Navbar (floating variant)
 *
 * Driven by scroll position, not a timeline. Two resting states
 * the bar springs between as you cross the threshold.
 *
 *   scrollY ≤ 24px   "top"      full-width bar, square, flush, no chrome
 *   scrollY >  24px   "floating" large centered pill: narrower, fully
 *                                rounded, dropped 12px, blurred card
 *                                surface with a border + shadow
 *
 * The "docs" variant opts out of this entirely: a flush, full-width
 * header bar so the documentation reads like a product surface.
 * ───────────────────────────────────────────────────────── */

import { motion, useMotionValueEvent, useScroll } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SCROLL = {
  threshold: 24, // px scrolled before the bar collapses into a pill
};

/* The morphing shell. Each key holds [top, floating] values. */
const SHELL = {
  maxWidth: [1120, 880], // px — full container → pill width
  radius: [0, 999], // border-radius
  offsetY: [0, 12], // px drop from the top edge
  paddingX: [24, 18], // horizontal padding
  paddingY: [14, 10], // vertical padding
  spring: { type: "spring" as const, stiffness: 320, damping: 32 },
};

const LINKS = [
  { label: "Docs", href: "/docs" },
  { label: "Harnesses", href: "/docs/harnesses" },
  { label: "Changelog", href: "/docs/changelog" },
];

function Logo() {
  return (
    <Link
      href="/"
      className="group relative flex items-center"
      aria-label="ap-sdk home"
    >
      {/* Pure-black monochrome mark — invert it in dark mode so it stays visible. */}
      <Image
        src="/ap-sdk.svg"
        alt="ap-sdk"
        width={36}
        height={36}
        priority
        unoptimized
        className="size-9 transition-opacity duration-200 group-hover:opacity-0 dark:invert"
      />
      {/* On hover the mark dissolves into a terminal-style wordmark. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center whitespace-nowrap font-mono text-sm font-medium text-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      >
        ap-sdk
        <span className="ml-1 inline-block h-4 w-[7px] animate-pulse bg-foreground" />
      </span>
    </Link>
  );
}

function NavLinks() {
  return (
    <div className="hidden items-center gap-1 md:flex">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

function Actions() {
  return (
    <div className="flex items-center gap-1.5">
      <ThemeToggle />
      <Button asChild variant="ghost" size="icon-sm" aria-label="GitHub">
        <a
          href="https://github.com/jal-co/agent-plugin-sdk"
          target="_blank"
          rel="noreferrer"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="size-4"
            aria-hidden="true"
          >
            <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C18 4.6 19 4.9 19 4.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
          </svg>
          <span className="sr-only">GitHub</span>
        </a>
      </Button>
      <Button asChild size="sm">
        <Link href="/docs">Get started</Link>
      </Button>
    </div>
  );
}

export function SiteNavbar({
  variant = "floating",
}: {
  variant?: "floating" | "docs";
}) {
  const { scrollY } = useScroll();
  const [floating, setFloating] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    setFloating(y > SCROLL.threshold);
  });

  // Docs: a flush, full-width header — no pill morph.
  if (variant === "docs") {
    return (
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between gap-6 px-6">
          <Logo />
          <NavLinks />
          <Actions />
        </div>
      </header>
    );
  }

  const i = floating ? 1 : 0;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4">
      <motion.nav
        layout
        initial={false}
        animate={{
          maxWidth: SHELL.maxWidth[i],
          borderRadius: SHELL.radius[i],
          y: SHELL.offsetY[i],
          paddingLeft: SHELL.paddingX[i],
          paddingRight: SHELL.paddingX[i],
          paddingTop: SHELL.paddingY[i],
          paddingBottom: SHELL.paddingY[i],
        }}
        transition={SHELL.spring}
        className={cn(
          "pointer-events-auto flex w-full items-center justify-between gap-6",
          "transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300",
          floating
            ? "border border-border bg-card/70 shadow-lg backdrop-blur-md"
            : "border border-transparent bg-transparent shadow-none",
        )}
      >
        <Logo />
        <NavLinks />
        <Actions />
      </motion.nav>
    </div>
  );
}
