import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Nodes } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import type { Metadata } from "next";
import { Fragment } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import { getMDXComponents } from "@/components/mdx";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Release notes for every published version of ap-sdk.",
};

// Tegami writes CHANGELOG.md next to the package manifest; the docs app builds
// from apps/docs, so reach back up to the SDK package.
const CHANGELOG_PATH = resolve(
  process.cwd(),
  "../../packages/agent-plugin-sdk/CHANGELOG.md",
);

async function renderMarkdown(md: string) {
  const processor = remark().use(remarkGfm).use(remarkRehype);
  const hast = (await processor.run(processor.parse(md))) as unknown as Nodes;
  return toJsxRuntime(hast, {
    Fragment,
    jsx,
    jsxs,
    components: getMDXComponents(),
  });
}

export default async function ChangelogPage() {
  const content = existsSync(CHANGELOG_PATH)
    ? await renderMarkdown(readFileSync(CHANGELOG_PATH, "utf8"))
    : null;

  return (
    <div className="mx-auto grid w-full max-w-[88rem] grid-cols-1 gap-10 px-6 pb-16 md:px-10">
      <div className="min-w-0">
        <div className="flex w-full max-w-[48rem] flex-col gap-8">
          <div className="flex flex-col gap-3 border-b border-border/60 pb-8">
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Changelog
            </h1>
            <p className="text-pretty text-lg leading-8 text-muted-foreground">
              Release notes for every published version of ap-sdk.
            </p>
          </div>

          {content ? (
            <div className="prose prose-zinc max-w-none dark:prose-invert prose-headings:scroll-mt-24 prose-headings:text-balance prose-pre:my-5 prose-code:before:content-none prose-code:after:content-none">
              {content}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No releases yet. Once the first version ships, its notes will
              appear here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
