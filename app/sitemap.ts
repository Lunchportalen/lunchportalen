import type { MetadataRoute } from "next";

/**
 * App-domain has no public SEO surface. All marketing content lives
 * on lunchportalen.no (Umbraco 17) with its own sitemap. Auth pages
 * (/registrering, /registrer-bruker, /login) are noindex.
 *
 * Sitemap intentionally empty. If app-domain ever needs to expose
 * indexable content (e.g. public product catalog), add entries here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
