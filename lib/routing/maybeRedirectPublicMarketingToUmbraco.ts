import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { delegatedPublicMarketingPathnames } from "@/lib/routing/delegatedPublicMarketingPaths";
import { readUmbracoPublicSiteUrl, shouldRedirectPublicMarketingToUmbracoHostedSite } from "@/lib/routing/publicMarketingSurface";

/**
 * When `UMBRACO_PUBLIC_SITE_URL` is set, redirect known marketing pathnames to that Umbraco-hosted origin.
 *
 * **Loop guard:** if the target URL's host equals the current request host, no redirect
 * (misconfiguration: same host cannot delegate to itself).
 */
export function maybeRedirectPublicMarketingToUmbracoHostedSite(req: NextRequest): NextResponse | null {
  if (!shouldRedirectPublicMarketingToUmbracoHostedSite()) return null;
  if (req.method !== "GET" && req.method !== "HEAD") return null;

  const pathname = req.nextUrl.pathname;
  if (!delegatedPublicMarketingPathnames().has(pathname)) return null;

  const base = readUmbracoPublicSiteUrl();
  if (!base) return null;

  let target: URL;
  try {
    target = new URL(pathname + req.nextUrl.search, `${base}/`);
  } catch {
    return null;
  }

  if (target.hostname === req.nextUrl.hostname) return null;

  return NextResponse.redirect(target, 307);
}
