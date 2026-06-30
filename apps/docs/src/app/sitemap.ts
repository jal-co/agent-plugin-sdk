import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/shared";
import { source } from "@/lib/source";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const abs = (path: string) => new URL(path, siteUrl).toString();

  const docs = source.getPages().map((page) => ({
    url: abs(page.url),
    lastModified: now,
  }));

  return [
    { url: siteUrl, lastModified: now },
    { url: abs("/docs/changelog"), lastModified: now },
    ...docs,
  ];
}
