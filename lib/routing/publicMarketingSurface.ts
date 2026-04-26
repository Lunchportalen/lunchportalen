/**
 * Browser-facing public marketing HTML is owned by Umbraco (Azure), not by Next as a primary renderer.
 *
 * When `UMBRACO_PUBLIC_SITE_URL` is set to the canonical public origin, middleware redirects delegated
 * marketing pathnames (see `delegatedPublicMarketingPaths.ts`) so traffic loads full HTML from Umbraco.
 *
 * When `UMBRACO_PUBLIC_SITE_URL` is unset (typical local dev), `app/(public)/` may still assemble pages
 * from Umbraco Delivery API inside Next; that is a development convenience, not the production public model.
 */
export function readUmbracoPublicSiteUrl(): string {
  return String(process.env.UMBRACO_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
}

export function shouldRedirectPublicMarketingToUmbracoHostedSite(): boolean {
  return Boolean(readUmbracoPublicSiteUrl());
}
