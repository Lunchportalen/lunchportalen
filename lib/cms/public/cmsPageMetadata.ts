/**
 * Build Next.js Metadata from CMS page content (body.meta + title + slug).
 * Single source for public [slug] generateMetadata. Editor SEO panel writes to body.meta;
 * this reads it with deterministic defaults and fallbacks.
 */

import type { Metadata } from "next";
import { absoluteUrl, canonicalForPath } from "@/lib/seo/site";

const TITLE_SUFFIX = " – Lunchportalen";
const DEFAULT_TITLE = "Lunchportalen";

export type CmsPageMetaInput = {
  /** Page title from content_pages.title */
  pageTitle: string | null;
  /** Page slug for canonical path when no override */
  slug: string;
  /** Raw body from content_page_variants (may contain { blocks, meta }) */
  body: unknown;
};

function safeStr(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : String(v);
  return s.trim();
}

function safeBool(v: unknown): boolean {
  if (v === true) return true;
  if (v === false) return false;
  return false;
}

function parseMetaFromBody(body: unknown): { seo: Record<string, unknown>; social: Record<string, unknown> } {
  const seo: Record<string, unknown> = {};
  const social: Record<string, unknown> = {};
  if (body == null || typeof body !== "object" || Array.isArray(body)) return { seo, social };
  const root = body as Record<string, unknown>;
  if (root.meta != null && typeof root.meta === "object" && !Array.isArray(root.meta)) {
    const meta = root.meta as Record<string, unknown>;
    if (meta.seo != null && typeof meta.seo === "object" && !Array.isArray(meta.seo)) {
      Object.assign(seo, meta.seo as Record<string, unknown>);
    }
    if (meta.social != null && typeof meta.social === "object" && !Array.isArray(meta.social)) {
      Object.assign(social, meta.social as Record<string, unknown>);
    }
  }
  return { seo, social };
}

/** Make OG image URL absolute. If relative path (starts with /), prepend site origin. */
function toAbsoluteOgImage(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/")) return absoluteUrl(trimmed);
  return absoluteUrl(`/${trimmed}`);
}

/**
 * Build Metadata for public CMS page. Uses body.meta.seo and body.meta.social when present;
 * falls back to page title and default canonical/robots.
 */
export function buildCmsPageMetadata(input: CmsPageMetaInput): Metadata {
  const { pageTitle, slug, body } = input;
  const { seo, social } = parseMetaFromBody(body);

  const slugPath = slug ? `/${slug.replace(/^\/+/, "")}` : "/";
  const canonicalPath = slugPath === "/" ? "/" : slugPath;

  const seoTitle = safeStr(seo.title);
  const seoDescription = safeStr(seo.description);
  const canonicalOverride = safeStr(seo.canonical) || safeStr(seo.canonicalUrl);
  const noIndex = safeBool(seo.noIndex);
  const noFollow = safeBool(seo.noFollow);
  const ogImageRaw = safeStr(seo.ogImage);
  const socialTitle = safeStr(social.title);
  const socialDescription = safeStr(social.description);

  const title = seoTitle || pageTitle?.trim() || DEFAULT_TITLE;
  const displayTitle = title.includes("–") || title.includes("Lunchportalen") ? title : `${title}${TITLE_SUFFIX}`;
  const description = seoDescription || undefined;
  const canonical = canonicalOverride
    ? (canonicalOverride.startsWith("http") ? canonicalOverride : canonicalForPath(canonicalOverride))
    : canonicalForPath(canonicalPath);
  const robots = { index: !noIndex, follow: !noFollow };

  const ogTitle = socialTitle || seoTitle || pageTitle?.trim() || displayTitle;
  const ogDescription = socialDescription || seoDescription || description;
  const ogImageUrl = ogImageRaw ? toAbsoluteOgImage(ogImageRaw) : undefined;

  const metadata: Metadata = {
    title: displayTitle,
    description,
    alternates: { canonical },
    robots,
    openGraph: {
      title: ogTitle,
      description: ogDescription ?? undefined,
      url: canonical,
      siteName: "Lunchportalen",
      locale: "nb_NO",
      type: "website",
      ...(ogImageUrl && {
        images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription ?? undefined,
      ...(ogImageUrl && { images: [ogImageUrl] }),
    },
  };

  return metadata;
}
