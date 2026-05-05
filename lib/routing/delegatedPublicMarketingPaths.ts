/**
 * Pathnames that correspond to public marketing/editorial URLs aligned with
 * `marketing-registry.json` + the same extras as `marketingUmbracoAllowlistedSlugs()`
 * (`lib/cms/umbraco/marketingAdapter.ts`).
 *
 * Used when `UMBRACO_PUBLIC_SITE_URL` is set to redirect browser traffic to the
 * Umbraco-hosted public site.
 *
 * Important:
 * `/registrering` belongs to the app/auth surface and must NOT be delegated to
 * Umbraco. Registration must stay on app.lunchportalen.no.
 */

import registry from "@/lib/seo/marketing-registry.json";

const APP_OWNED_PATHS = new Set<string>([
  "/registrering",
]);

function normalizePathname(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const withoutTrailingSlash =
    normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;

  return withoutTrailingSlash.toLowerCase();
}

function buildBaseDelegatedPaths(): Set<string> {
  const paths = new Set<string>();

  for (const path of Object.keys(registry as Record<string, unknown>)) {
    const normalized = normalizePathname(path);

    if (!APP_OWNED_PATHS.has(normalized)) {
      paths.add(normalized);
    }
  }

  paths.add("/faq");

  for (const appPath of APP_OWNED_PATHS) {
    paths.delete(appPath);
  }

  return paths;
}

const BASE_DELEGATED_PUBLIC_MARKETING_PATHS = buildBaseDelegatedPaths();

/**
 * Marketing pathnames that may be delegated to the Umbraco-hosted public origin
 * (same coverage as Delivery-allowlisted marketing slugs, expressed as pathnames).
 */
export function delegatedPublicMarketingPathnames(): ReadonlySet<string> {
  const extra = String(process.env.LP_MARKETING_UMBRACO_EXTRA_SLUG ?? "phase1-demo")
    .trim()
    .toLowerCase();

  if (!extra) {
    return BASE_DELEGATED_PUBLIC_MARKETING_PATHS;
  }

  const extraPath = normalizePathname(extra);
  const out = new Set(BASE_DELEGATED_PUBLIC_MARKETING_PATHS);

  if (!APP_OWNED_PATHS.has(extraPath)) {
    out.add(extraPath);
  }

  return out;
}