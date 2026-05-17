import type { MetadataRoute } from "next";

/**
 * App-verten er applikasjon: innlogging, redirects til public site, og
 * autentiserte flater. Ikke crawl eller indekser denne origin;
 * kanonisk offentlig SEO ligger på lunchportalen.no.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: ["/"],
      },
    ],
  };
}
