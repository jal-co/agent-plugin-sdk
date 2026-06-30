import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsToc } from "@/components/docs-toc";
import { getMDXComponents } from "@/components/mdx";
import { getPageImage, source } from "@/lib/source";

export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const toc = page.data.toc;

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

      <DocsToc items={toc} />
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
