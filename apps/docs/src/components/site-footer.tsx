import Link from "next/link";
import { ComponentCredits } from "@/components/component-credits";

const links = [
  { label: "Docs", href: "/docs" },
  { label: "Harnesses", href: "/docs/harnesses" },
  { label: "Changelog", href: "/docs/changelog" },
  { label: "GitHub", href: "https://github.com/jal-co/agent-plugin-sdk" },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-sm text-muted-foreground">
          agent-plugin-sdk
        </p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <ComponentCredits />
        </nav>
        <p className="text-sm text-muted-foreground">
          MIT · originally by{" "}
          <a
            href="https://github.com/jnsahaj"
            className="transition-colors hover:text-foreground"
          >
            Sahaj Jain
          </a>
        </p>
      </div>
    </footer>
  );
}
