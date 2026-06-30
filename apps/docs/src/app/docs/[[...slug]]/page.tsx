import { getGithubLastEdit } from "fumadocs-core/content/github";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AiCopyButton } from "@/components/ai-copy-button";
import { DocsToc } from "@/components/docs-toc";
import { getMDXComponents } from "@/components/mdx";
import { gitConfig } from "@/lib/shared";
import { getLLMText, getPageImage, source } from "@/lib/source";
import { cn } from "@/lib/utils";

/** Last commit time for a docs file (GitHub API; skipped in dev to dodge rate limits). */
async function getLastEdit(filePath: string): Promise<Date | null> {
  if (process.env.NODE_ENV === "development") return null;
  try {
    return await getGithubLastEdit({
      owner: gitConfig.user,
      repo: gitConfig.repo,
      path: `apps/docs/content/docs/${filePath}`,
      token: process.env.GIT_TOKEN
        ? `Bearer ${process.env.GIT_TOKEN}`
        : undefined,
    });
  } catch {
    return null;
  }
}

export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const toc = page.data.toc;
  const pageText = await getLLMText(page);
  const lastEdit = await getLastEdit(page.path);

  return (
    <div className="mx-auto grid w-full max-w-[88rem] grid-cols-1 gap-10 px-6 pb-16 md:px-10 xl:grid-cols-[minmax(0,1fr)_14rem] xl:gap-12">
      <div className="min-w-0">
        <div className="flex w-full max-w-[48rem] flex-col gap-8">
          <div className="flex flex-col gap-3 border-b border-border/60 pb-8">
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {page.data.title}
            </h1>
            {page.data.description ? (
              <p className="text-pretty text-lg leading-8 text-muted-foreground">
                {page.data.description}
              </p>
            ) : null}
          </div>

          <div className="prose prose-zinc max-w-none dark:prose-invert prose-headings:scroll-mt-24 prose-headings:text-balance prose-p:text-pretty prose-pre:my-5 prose-code:before:content-none prose-code:after:content-none">
            <MDX components={getMDXComponents()} />
          </div>
        </div>
      </div>

      <div className="hidden xl:block">
        <div className="sticky top-24 flex max-h-[calc(100vh-7rem)] flex-col">
          <DocsToc items={toc} />
          <div
            className={cn(
              "flex flex-col gap-3",
              toc.length > 0 && "mt-6 border-t border-border/60 pt-6",
            )}
          >
            <AiCopyButton
              value={pageText}
              label="Copy page"
              brandColors
              size="sm"
              className="self-start"
            />
            {lastEdit ? (
              <p className="text-xs text-muted-foreground">
                Last edited{" "}
                {new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(
                  lastEdit,
                )}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(
  props: PageProps<"/docs/[[...slug]]">,
): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImage(page).url,
    },
  };
}
