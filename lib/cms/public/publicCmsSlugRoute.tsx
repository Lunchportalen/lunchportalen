/**
 * Shared server render for public CMS slugs (`loadPublicPageWithTrustFallback` → CmsBlockRenderer).
 * Used by `app/(public)/[slug]/page.tsx` and explicit `app/(public)/<slug>/page.tsx` for SEO audit parity.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PageShell from "@/components/PageShell";
import { CmsBlockRenderer } from "@/components/cms/CmsBlockRenderer";
import { buildCmsPageMetadata } from "@/lib/cms/public/cmsPageMetadata";
import {
  buildEditorialFailClosedMetadata,
  EDITORIAL_FAIL_CLOSED_DESCRIPTION,
} from "@/lib/cms/public/editorialFailClosedMetadata";
import { canonicalPathForPublicEditorialSlug } from "@/lib/cms/public/canonicalPathForPublicEditorialSlug";
import { loadPublicPageWithTrustFallback } from "@/lib/cms/public/loadPublicPageWithTrustFallback";
import { PublicCmsStructuredData } from "@/components/seo/CmsStructuredData";

const ENV: "prod" | "staging" =
  typeof process.env.NEXT_PUBLIC_APP_ENV === "string" && process.env.NEXT_PUBLIC_APP_ENV === "staging"
    ? "staging"
    : "prod";
const LOCALE: "nb" | "en" = "nb";

type SP = Record<string, string | string[] | undefined> | undefined;

function isPreviewFromSearchParams(sp: SP): boolean {
  const raw = sp?.preview;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "true";
}

export { canonicalPathForPublicEditorialSlug } from "@/lib/cms/public/canonicalPathForPublicEditorialSlug";

export async function generatePublicCmsSlugMetadata(
  slug: string,
  searchParams?: Promise<SP> | SP,
): Promise<Metadata> {
  const sp = await Promise.resolve(searchParams ?? {});
  const content = await loadPublicPageWithTrustFallback(slug, { preview: isPreviewFromSearchParams(sp) });
  if (!content) {
    return buildEditorialFailClosedMetadata(canonicalPathForPublicEditorialSlug(slug), "seed-no-row");
  }
  if (content.publicContentOrigin === "seed-no-row" || content.publicContentOrigin === "seed-empty-body") {
    return buildEditorialFailClosedMetadata(content.slug ?? slug, content.publicContentOrigin);
  }
  if (content.blocks.length === 0) {
    return buildEditorialFailClosedMetadata(content.slug ?? slug, "seed-empty-body");
  }
  return buildCmsPageMetadata({
    pageTitle: content.title ?? null,
    slug: content.slug ?? slug,
    body: content.body,
  });
}

export async function PublicCmsSlugPageView({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams?: Promise<SP> | SP;
}) {
  const sp = await Promise.resolve(searchParams ?? {});
  const content = await loadPublicPageWithTrustFallback(slug, { preview: isPreviewFromSearchParams(sp) });
  if (!content) notFound();

  const safeBlocks = content.blocks;

  const canonicalPath = canonicalPathForPublicEditorialSlug(content.slug);

  return (
    <PageShell>
      <PublicCmsStructuredData
        page={{ title: content.title, slug: content.slug, body: content.body }}
        canonicalPath={canonicalPath}
      />
      <article
        className="lp-container mx-auto max-w-4xl px-4 py-8"
        data-lp-public-cms-slug={content.slug}
        data-lp-public-cms-origin={content.publicContentOrigin}
      >
        {content.title ? (
          <h1 className="lp-h1 mb-6 text-[rgb(var(--lp-text))]">{content.title}</h1>
        ) : null}
        <div className="flex flex-col gap-6">
          <CmsBlockRenderer
            blocks={safeBlocks}
            env={ENV}
            locale={LOCALE}
            enableLivePricing
            blockWrapperClassName="w-full"
            pageCmsMeta={content.meta}
          />
        </div>
        {safeBlocks.length === 0 ? (
          <p className="text-sm text-slate-600">
            {content.publicContentOrigin === "seed-no-row" || content.publicContentOrigin === "seed-empty-body"
              ? EDITORIAL_FAIL_CLOSED_DESCRIPTION
              : "Ingen innhold å vise."}
          </p>
        ) : null}
      </article>
    </PageShell>
  );
}
