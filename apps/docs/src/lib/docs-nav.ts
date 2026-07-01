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
 * Build sectioned, serializable nav groups from the Fumadocs page tree so the
 * (client) sidebar stays in sync with content. `---Label---` separators in
 * meta.json become section headings; pages fall under the preceding section.
 */
export function getDocsNav(): DocsNavGroup[] {
  const tree = source.getPageTree();
  const groups: DocsNavGroup[] = [];
  let current: DocsNavGroup = { items: [] };

  const flush = () => {
    if (current.items.length) groups.push(current);
  };

  for (const node of tree.children) {
    if (node.type === "separator") {
      flush();
      current = { title: nodeName(node.name), items: [] };
    } else if (node.type === "page") {
      current.items.push({ title: nodeName(node.name), url: node.url });
    } else if (node.type === "folder") {
      flush();
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
      current = { items: [] };
    }
  }
  flush();

  // The changelog is a standalone route (not MDX content), so append it to the
  // last section by hand.
  const last = groups.at(-1);
  const plugins: DocsNavItem = { title: "Plugins", url: "/docs/plugins" };
  const changelog: DocsNavItem = { title: "Changelog", url: "/docs/changelog" };
  if (last) last.items.push(plugins, changelog);
  else groups.push({ items: [plugins, changelog] });

  return groups;
}

export function getDocsNavFlat(): DocsNavItem[] {
  return getDocsNav().flatMap((group) => group.items);
}
