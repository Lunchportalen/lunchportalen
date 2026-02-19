import type { MetadataRoute } from "next";

import { listMarketingPages } from "@/lib/seo/marketingRegistry";
import { absoluteUrl } from "@/lib/seo/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = listMarketingPages().filter((entry) => entry.isIndexable);

  return pages.map((entry) => ({
    url: absoluteUrl(entry.path),
    lastModified: entry.lastmod && entry.lastmod !== "auto" ? new Date(entry.lastmod) : new Date(),
    changeFrequency: entry.changefreq,
    priority: entry.priority,
  }));
}
