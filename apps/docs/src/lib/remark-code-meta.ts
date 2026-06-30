import type { Code, Root } from "mdast";
import { visit } from "unist-util-visit";

/**
 * Carry a fenced code block's "meta" string (the text after the language —
 * e.g. ```bash compact) onto the emitted <code> element as a `data-meta`
 * attribute, so MDX component overrides can read per-block options. Needed
 * because Fumadocs' own highlighter (which normally consumes meta) is disabled.
 */
export function remarkCodeMeta() {
  return (tree: Root) => {
    visit(tree, "code", (node: Code) => {
      if (!node.meta) return;
      node.data ??= {};
      const data = node.data as { hProperties?: Record<string, unknown> };
      data.hProperties = {
        ...(data.hProperties ?? {}),
        "data-meta": node.meta,
      };
    });
  };
}
