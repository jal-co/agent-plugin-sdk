import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { remarkCodeMeta } from "./src/lib/remark-code-meta";

// You can customize Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.dev/docs/mdx/collections
export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    // Fenced code is rendered by the jalco CodeBlock (its own shiki pass), so
    // disable Fumadocs' built-in highlighter to avoid double-processing.
    rehypeCodeOptions: false,
    // Preserve fence meta (e.g. ```bash compact) onto the <code> element.
    remarkPlugins: (v) => [...v, remarkCodeMeta],
  },
});
