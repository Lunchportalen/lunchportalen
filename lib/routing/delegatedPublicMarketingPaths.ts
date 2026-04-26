/**
 * Pathnames that correspond to public marketing/editorial URLs aligned with
 * `marketing-registry.json` + the same extras as `marketingUmbracoAllowlistedSlugs()`
 * (`lib/cms/umbraco/marketingAdapter.ts`).
 *
 * Used when `UMBRACO_PUBLIC_SITE_URL` is set to redirect browser traffic to the Umbraco-hosted public site.
 */
import registry from "@/lib/seo/marketing-registry.json";

function buildBaseDelegatedPaths(): Set<string> {
  const s = new Set<string>();
  for (const path of Object.keys(registry as Record<string, unknown>)) {
    s.add(path.startsWith("/") ? path : `/${path}`);
  }
  s.add("/faq");
  s.add("/registrering");
  return s;
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
  if (!extra) return BASE_DELEGATED_PUBLIC_MARKETING_PATHS;
  const out = new Set(BASE_DELEGATED_PUBLIC_MARKETING_PATHS);
  out.add(`/${extra}`);
  return out;
}
