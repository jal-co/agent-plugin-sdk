"use client";

import Image from "next/image";
import Link from "next/link";
import { DocsSearch } from "@/components/search-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const LINKS = [
  { label: "Docs", href: "/docs" },
  { label: "Harnesses", href: "/docs/harnesses" },
  { label: "Plugins", href: "/docs/plugins" },
  { label: "Changelog", href: "/docs/changelog" },
];

function Logo() {
  return (
    <Link
      href="/"
      className="group relative flex items-center"
      aria-label="ap-sdk home"
    >
      <Image
        src="/ap-sdk.svg"
        alt="ap-sdk"
        width={36}
        height={36}
        priority
        unoptimized
        className="size-9 transition-opacity duration-200 group-hover:opacity-0 dark:invert"
      />
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
      <DocsSearch />
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

export function SiteNavbar() {
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
