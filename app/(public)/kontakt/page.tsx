import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import PageShell from "@/components/PageShell";
import { CmsBlockRenderer } from "@/components/cms/CmsBlockRenderer";
import { PublicCmsStructuredData } from "@/components/seo/CmsStructuredData";
import { canonicalPathForPublicEditorialSlug } from "@/lib/cms/public/canonicalPathForPublicEditorialSlug";
import {
  generatePublicCmsSlugMetadata,
} from "@/lib/cms/public/publicCmsSlugRoute";
import { EDITORIAL_FAIL_CLOSED_DESCRIPTION } from "@/lib/cms/public/editorialFailClosedMetadata";
import { loadPublicPageWithTrustFallback } from "@/lib/cms/public/loadPublicPageWithTrustFallback";
import KontaktClient from "./KontaktClient";

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

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<SP> | SP;
}): Promise<Metadata> {
  return generatePublicCmsSlugMetadata("kontakt", searchParams);
}

export default async function KontaktPage({
  searchParams,
}: {
  searchParams?: Promise<SP> | SP;
}) {
  const sp = await Promise.resolve(searchParams ?? {});
  const content = await loadPublicPageWithTrustFallback("kontakt", { preview: isPreviewFromSearchParams(sp) });
  if (!content) {
    notFound();
  }

  const safeBlocks = content.blocks;

  const cmsOrigin = content.publicContentOrigin;

  return (
    <>
      <PublicCmsStructuredData
        page={{ title: content.title, slug: content.slug, body: content.body }}
        canonicalPath={canonicalPathForPublicEditorialSlug("kontakt")}
      />
      <PageShell>
      <div
        className="lp-container mx-auto max-w-5xl px-4 py-7 sm:py-9"
        data-lp-public-cms-slug="kontakt"
        data-lp-public-cms-origin={cmsOrigin}
      >
        <header className="mb-6">
          {content.title ? (
            <h1 className="lp-h1 mb-2 text-[rgb(var(--lp-text))]">{content.title}</h1>
          ) : null}
        </header>
        <div className="mb-8 flex flex-col gap-6">
          {safeBlocks.length === 0 &&
          (cmsOrigin === "seed-no-row" || cmsOrigin === "seed-empty-body") ? (
            <p className="text-sm text-slate-600">{EDITORIAL_FAIL_CLOSED_DESCRIPTION}</p>
          ) : null}
          <CmsBlockRenderer
            blocks={safeBlocks}
            env={ENV}
            locale={LOCALE}
            enableLivePricing
            blockWrapperClassName="w-full"
            pageCmsMeta={content.meta}
          />
        </div>
        <Suspense fallback={null}>
          <KontaktClient hidePageHeader />
        </Suspense>
      </div>
    </PageShell>
    </>
  );
}
