import { absoluteUrl, canonicalForPath, siteName } from "@/lib/seo/site";

export type JsonLdFaqItem = { q: string; a: string };
export type JsonLdBreadcrumbItem = { name: string; item: string };
export type WebPageJsonLdInput = { url: string; name: string; description: string; inLanguage?: string };

function compact(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toAbsolute(urlOrPath: string): string {
  const value = compact(urlOrPath);
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return absoluteUrl(value);
}

function cleanObject<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out as T;
}

/**
 * WebPage JSON-LD must never throw for empty SEO fields: callers include CMS pages where
 * `meta.seo.description` may be unset (live) or empty (fail-closed). Use minimal deterministic fallbacks.
 */
export function webPageJsonLd(input: WebPageJsonLdInput) {
  const url = toAbsolute(input.url);
  const name = compact(input.name) || siteName();
  const description = compact(input.description) || name;
  const inLanguage = compact(input.inLanguage || "nb-NO") || "nb-NO";

  if (!url) {
    throw new Error("SEO_JSONLD_WEBPAGE_INVALID");
  }

  return cleanObject({
    "@context": "https://schema.org",
    "@type": "WebPage",
    url,
    name,
    description,
    inLanguage,
  });
}

export function articleJsonLd(input: {
  url: string;
  headline: string;
  description: string;
  image: string;
  datePublished?: string;
  dateModified?: string;
}) {
  const url = toAbsolute(input.url);
  const headline = compact(input.headline);
  const description = compact(input.description);
  const image = toAbsolute(input.image);

  if (!url || !headline || !description || !image) {
    throw new Error("SEO_JSONLD_ARTICLE_INVALID");
  }

  const nowIso = new Date().toISOString();

  return cleanObject({
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    inLanguage: "nb-NO",
    mainEntityOfPage: url,
    image,
    datePublished: compact(input.datePublished || nowIso),
    dateModified: compact(input.dateModified || nowIso),
    author: {
      "@type": "Organization",
      name: siteName(),
    },
    publisher: {
      "@type": "Organization",
      name: siteName(),
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/brand/LP-logo-uten-bakgrunn.png"),
      },
    },
  });
}

export function breadcrumbJsonLd(items: JsonLdBreadcrumbItem[]) {
  const list = (items || [])
    .map((item, index) => {
      const name = compact(item?.name || "");
      const entry = toAbsolute(item?.item || "");
      if (!name || !entry) return null;
      return {
        "@type": "ListItem",
        position: index + 1,
        name,
        item: entry,
      };
    })
    .filter(Boolean);

  if (!list.length) {
    throw new Error("SEO_JSONLD_BREADCRUMB_EMPTY");
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: list,
  };
}

export function faqJsonLd(faqItems: JsonLdFaqItem[]) {
  const mainEntity = (faqItems || [])
    .map((item) => {
      const q = compact(item?.q || "");
      const a = compact(item?.a || "");
      if (!q || !a) return null;
      return {
        "@type": "Question",
        name: q,
        acceptedAnswer: {
          "@type": "Answer",
          text: a,
        },
      };
    })
    .filter(Boolean);

  if (!mainEntity.length) {
    throw new Error("SEO_JSONLD_FAQ_EMPTY");
  }

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
  };
}

export function organizationJsonLd() {
  return cleanObject({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName(),
    url: canonicalForPath("/"),
    logo: absoluteUrl("/brand/LP-logo-uten-bakgrunn.png"),
  });
}
