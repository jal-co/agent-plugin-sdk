import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { type ComponentProps, isValidElement, type ReactNode } from "react";
import { Callout as CalloutBase } from "@/components/callout";
import { CodeBlock as CodeBlockBase } from "@/components/code-block";
import { CodeBlockCommand as CodeBlockCommandBase } from "@/components/code-block-command";
import { CodeLine as CodeLineBase } from "@/components/code-line";
import { SupportMatrix } from "@/components/support-matrix";
import { Tab as TabBase, Tabs as TabsBase } from "@/components/tabs";
import { convertNpmCommand } from "@/lib/convert-npm-command";
import { cn } from "@/lib/utils";

/**
 * Code components are self-contained cards, so they must opt out of the
 * surrounding `.prose` typography (otherwise prose restyles their inner <pre>
 * and paints a second nested box).
 */
function CodeBlock({
  className,
  ...props
}: ComponentProps<typeof CodeBlockBase>) {
  return (
    <CodeBlockBase className={cn("not-prose my-6", className)} {...props} />
  );
}

function CodeLine({
  className,
  ...props
}: ComponentProps<typeof CodeLineBase>) {
  return (
    <CodeLineBase className={cn("not-prose my-4", className)} {...props} />
  );
}

function CodeBlockCommand({
  className,
  ...props
}: ComponentProps<typeof CodeBlockCommandBase>) {
  return (
    <CodeBlockCommandBase
      className={cn("not-prose my-6", className)}
      {...props}
    />
  );
}

function Callout({ className, ...props }: ComponentProps<typeof CalloutBase>) {
  return <CalloutBase className={cn("not-prose my-6", className)} {...props} />;
}

function Tabs({ className, ...props }: ComponentProps<typeof TabsBase>) {
  return <TabsBase className={cn("not-prose my-6", className)} {...props} />;
}

/**
 * Tabbed install/CLI command block. Author one npm-style command; the other
 * package managers are derived so docs never drift between managers.
 */
function NpmCommand({
  command,
  ...props
}: { command: string } & ComponentProps<typeof CodeBlockCommandBase>) {
  return <CodeBlockCommand {...convertNpmCommand(command)} {...props} />;
}

/** Flatten an MDX node tree (fenced code) down to its raw text. */
function extractText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    return extractText((node.props as { children?: ReactNode }).children);
  }
  return "";
}

/**
 * Route fenced code blocks through the Geist-style components. Fumadocs'
 * highlighter is disabled (see source.config), so `pre > code` arrives as raw
 * text with a `language-*` class. Single-line snippets become a compact
 * CodeLine; everything else becomes a full CodeBlock.
 */
function Pre({ children }: ComponentProps<"pre">) {
  const codeEl = isValidElement<{
    className?: string;
    children?: ReactNode;
    "data-meta"?: string;
  }>(children)
    ? children
    : null;
  const className = codeEl?.props.className ?? "";
  const language = /language-(\w+)/.exec(className)?.[1] ?? "text";
  const code = extractText(children).replace(/\n+$/, "");

  // Per-fence options from the meta string, e.g. ```bash compact title="foo".
  const meta = codeEl?.props["data-meta"] ?? "";
  const compact = /\bcompact\b/.test(meta);
  const title = /title="([^"]+)"/.exec(meta)?.[1];

  if (!code.includes("\n")) {
    return <CodeLine code={code} language={language} />;
  }
  return (
    <CodeBlock
      code={code}
      language={language}
      title={title}
      compact={compact}
    />
  );
}

/** Grid wrapper for a set of navigational <Card>s. */
function Cards({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("not-prose grid gap-3 sm:grid-cols-2", className)}
      {...props}
    />
  );
}

/** A linked card used in docs landing/next-steps sections. */
function Card({
  title,
  description,
  href,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  href?: string;
  children?: ReactNode;
}) {
  const body = (
    <div className="group flex h-full flex-col gap-1 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-accent/40">
      <span className="text-sm font-medium text-foreground">{title}</span>
      {description ? (
        <span className="text-sm text-muted-foreground">{description}</span>
      ) : null}
      {children ? (
        <span className="text-sm text-muted-foreground">{children}</span>
      ) : null}
    </div>
  );

  if (!href) return body;

  return (
    <Link href={href} className="no-underline">
      {body}
    </Link>
  );
}

/** Internal links use next/link; external links fall back to <a>. */
function Anchor({ href = "", ...props }: ComponentProps<"a">) {
  if (href.startsWith("/")) {
    return <Link href={href} {...props} />;
  }
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      {...props}
    />
  );
}

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    a: Anchor,
    pre: Pre,
    Cards,
    Card,
    CodeBlock,
    CodeLine,
    CodeBlockCommand,
    Callout,
    Tabs,
    Tab: TabBase,
    NpmCommand,
    SupportMatrix,
    ...components,
  };
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
