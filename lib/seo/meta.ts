import type { Metadata } from "next";

import type { MarketingPage } from "@/lib/seo/marketingRegistry";
import { absoluteUrl, canonicalForPath, pageMetaDefaults } from "@/lib/seo/site";

function assertNonEmpty(value: string, code: string): string {
  const out = String(value ?? "").trim();
  if (!out) {
    throw new Error(code);
  }
  return out;
}

function toAbsoluteMaybe(value: string): string {
  const trimmed = assertNonEmpty(value, "SEO_META_OG_IMAGE_REQUIRED");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (!trimmed.startsWith("/")) {
    throw new Error("SEO_META_OG_IMAGE_INVALID");
  }

  return absoluteUrl(trimmed);
}

export function createPageMetadata(entry: MarketingPage): Metadata {
  const defaults = pageMetaDefaults();

  const path = assertNonEmpty(entry.path, "SEO_META_PATH_REQUIRED");
  const title = assertNonEmpty(entry.title, "SEO_META_TITLE_REQUIRED");
  const description = assertNonEmpty(entry.description, "SEO_META_DESCRIPTION_REQUIRED");
  const image = toAbsoluteMaybe(entry.ogImage);

  const canonical = canonicalForPath(path);

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots: {
      index: !!entry.isIndexable,
      follow: !!entry.isIndexable,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: defaults.siteName,
      locale: defaults.locale,
      type: entry.pageType,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
