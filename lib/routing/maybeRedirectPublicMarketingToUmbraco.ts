import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { delegatedPublicMarketingPathnames } from "@/lib/routing/delegatedPublicMarketingPaths";
import {
  readUmbracoPublicSiteUrl,
  shouldRedirectPublicMarketingToUmbracoHostedSite,
} from "@/lib/routing/publicMarketingSurface";

function isNextRscRequest(req: NextRequest): boolean {
  return (
    req.nextUrl.searchParams.has("_rsc") ||
    req.nextUrl.searchParams.has("rsc") ||
    req.headers.get("rsc") === "1" ||
    req.headers.get("next-router-prefetch") === "1"
  );
}

/**
 * Redirect known public marketing/editorial pathnames from the app surface
 * to the configured Umbraco public origin.
 *
 * Important:
 * - app.lunchportalen.no = Next.js app surface
 * - www.lunchportalen.no = Umbraco public marketing surface
 * - /registrering belongs to the app and must not be delegated here
 *
 * Loop guard:
 * if the target URL's host equals the current request host, no redirect.
 */
export function maybeRedirectPublicMarketingToUmbracoHostedSite(
  req: NextRequest
): NextResponse | null {
  if (!shouldRedirectPublicMarketingToUmbracoHostedSite()) return null;
  if (req.method !== "GET" && req.method !== "HEAD") return null;
  if (isNextRscRequest(req)) return null;

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