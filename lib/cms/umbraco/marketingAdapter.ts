/**
 * Phase-1 Umbraco marketing read: Delivery API → legacy body for parseBody / CmsBlockRenderer.
 */
import registryData from "@/lib/seo/marketing-registry.json";
import {
  mapUmbracoDeliveryItemToContentBySlugResult,
  type UmbracoMappedMarketingContent,
} from "@/lib/cms/umbraco/mapDeliveryItemToLegacyMarketingBody";

function envTrim(name: string): string {
  return String(process.env[name] ?? "").trim();
}

/** Public marketing routes read from Umbraco Delivery whenever the base URL is configured (no optional "CMS source" toggle). */
export function isUmbracoDeliveryConfigured(): boolean {
  return Boolean(envTrim("UMBRACO_DELIVERY_BASE_URL"));
}

/** @deprecated Use {@link isUmbracoDeliveryConfigured} */
export function isUmbracoMarketingDualReadEnabled(): boolean {
  return isUmbracoDeliveryConfigured();
}

/** Map `marketing-registry.json` path → Delivery item slug (same as URL segment; `/` → `home`). */
export function marketingSlugFromRegistryPath(path: string): string {
  const p = String(path ?? "").trim();
  if (!p || p === "/") return "home";
  return p.replace(/^\/+/, "").split("/")[0]!.toLowerCase();
}

/**
 * All public marketing HTML routes in `marketing-registry.json` are Umbraco Delivery–backed at runtime.
 * Also: `faq`, `registrering`, and `LP_MARKETING_UMBRACO_EXTRA_SLUG` (default `phase1-demo`).
 */
export function marketingUmbracoAllowlistedSlugs(): Set<string> {
  const extra = envTrim("LP_MARKETING_UMBRACO_EXTRA_SLUG").toLowerCase() || "phase1-demo";
  const registry = registryData as Record<string, unknown>;
  const s = new Set<string>();
  for (const path of Object.keys(registry)) {
    s.add(marketingSlugFromRegistryPath(path));
  }
  s.add(extra);
  s.add("faq");
  s.add("registrering");
  return s;
}

export function isMarketingSlugUmbracoAllowlisted(slug: string): boolean {
  return marketingUmbracoAllowlistedSlugs().has(slug.trim().toLowerCase());
}

/**
 * Allowlisted public slugs (except `home`) get an explicit empty editorial fallback when Delivery misses or returns no blocks,
 * so routes stay fail-closed (no Supabase editorial substitute) without 404 for navigable URLs.
 */
export function isPublicUmbracoEditorialFallbackSlug(slug: string): boolean {
  const n = slug.trim().toLowerCase();
  if (n === "home") return false;
  return isMarketingSlugUmbracoAllowlisted(n);
}

function deliveryBaseUrl(): string {
  const u = envTrim("UMBRACO_DELIVERY_BASE_URL").replace(/\/+$/, "");
  return u;
}

function buildItemUrl(slug: string, preview: boolean): string {
  const base = deliveryBaseUrl();
  const pathSeg = encodeURIComponent(slug);
  const url = new URL(`${base}/umbraco/delivery/api/v2/content/item/${pathSeg}`);
  if (preview) url.searchParams.set("preview", "true");
  return url.toString();
}

function deliveryHeaders(preview: boolean): Headers {
  const h = new Headers();
  h.set("Accept", "application/json");
  h.set("Accept-Language", "nb-NO");
  const apiKey = envTrim("UMBRACO_DELIVERY_API_KEY");
  if (apiKey) h.set("Api-Key", apiKey);
  const startItem = envTrim("UMBRACO_DELIVERY_START_ITEM");
  if (startItem) h.set("Start-Item", startItem);
  if (preview) h.set("Preview", "true");
  return h;
}

/**
 * Fetches one marketing page from Umbraco Delivery API and maps to `ContentBySlugResult`, or null on miss/error.
 */
export async function fetchMarketingFromUmbracoBySlug(
  slug: string,
  options?: { preview?: boolean },
): Promise<UmbracoMappedMarketingContent | null> {
  if (!isUmbracoDeliveryConfigured()) return null;
  if (!isMarketingSlugUmbracoAllowlisted(slug)) return null;

  const preview = options?.preview === true;
  const url = buildItemUrl(slug, preview);
  const res = await fetch(url, {
    method: "GET",
    headers: deliveryHeaders(preview),
    cache: "no-store",
  });

  if (!res.ok) return null;

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return null;
  }

  return mapUmbracoDeliveryItemToContentBySlugResult(json, { slug });
}

export { mapUmbracoDeliveryItemToContentBySlugResult } from "@/lib/cms/umbraco/mapDeliveryItemToLegacyMarketingBody";
