import type { ReactNode } from "react";
import { source } from "@/lib/source";

export interface DocsNavItem {
  title: string;
  url: string;
}

export interface DocsNavGroup {
  title?: string;
  items: DocsNavItem[];
}

function nodeName(name: ReactNode): string {
  return typeof name === "string" ? name : String(name ?? "");
}

/**
 * Flatten the Fumadocs page tree into plain, serializable nav groups so the
 * (client) sidebar stays in sync with content without importing server code.
 * Loose top-level pages become one leading group; folders become their own.
 */
export function getDocsNav(): DocsNavGroup[] {
  const tree = source.getPageTree();
  const groups: DocsNavGroup[] = [];
  const loose: DocsNavItem[] = [];

  for (const node of tree.children) {
    if (node.type === "page") {
      loose.push({ title: nodeName(node.name), url: node.url });
    } else if (node.type === "folder") {
      const items: DocsNavItem[] = [];
      if (node.index) {
        items.push({ title: nodeName(node.index.name), url: node.index.url });
      }
      for (const child of node.children) {
        if (child.type === "page") {
          items.push({ title: nodeName(child.name), url: child.url });
        }
      }
      if (items.length) groups.push({ title: nodeName(node.name), items });
    }
  }

  if (loose.length) groups.unshift({ items: loose });
  return groups;
}
