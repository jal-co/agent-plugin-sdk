import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { SupportMatrix } from "@/components/support-matrix";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    SupportMatrix,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
