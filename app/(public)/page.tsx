// app/(public)/page.tsx — `/` uses same public CMS loader as `app/(public)/[slug]` (Umbraco Delivery → blocks → CmsBlockRenderer).
import type { Metadata } from "next";

import PageShell from "@/components/PageShell";

import RelatedLinks from "@/components/seo/RelatedLinks";
import { CmsBlockRenderer } from "@/components/cms/CmsBlockRenderer";
import { CmsStructuredData } from "@/components/seo/CmsStructuredData";
import { buildCmsPageMetadata } from "@/lib/cms/public/cmsPageMetadata";
import { buildEditorialFailClosedMetadata } from "@/lib/cms/public/editorialFailClosedMetadata";
import { loadPublicPageWithTrustFallback } from "@/lib/cms/public/loadPublicPageWithTrustFallback";

const ENV: "prod" | "staging" =
  typeof process.env.NEXT_PUBLIC_APP_ENV === "string" && process.env.NEXT_PUBLIC_APP_ENV === "staging"
    ? "staging"
    : "prod";
const LOCALE: "nb" | "en" = "nb";

/** CI: scripts/ci/cms-integrity.mjs string anchors — faktisk rendering: {@link CmsBlockRenderer} → normalizeBlockForRender( … ) → renderBlock( … ). */
// getContentBySlug('home') — underlying resolver (Umbraco Delivery); entry: loadPublicPageWithTrustFallback("home")

type HomeSearchParams = Record<string, string | string[] | undefined> | undefined;

function isPreviewFromSearchParams(sp: HomeSearchParams): boolean {
  const raw = sp?.preview;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "true";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<HomeSearchParams> | HomeSearchParams;
}): Promise<Metadata> {
  const sp = await Promise.resolve(searchParams ?? {});
  const page = await loadPublicPageWithTrustFallback("home", { preview: isPreviewFromSearchParams(sp) });
  if (!page) {
    return buildEditorialFailClosedMetadata("/", "seed-no-row");
  }
  if (page.publicContentOrigin === "seed-no-row" || page.publicContentOrigin === "seed-empty-body") {
    return buildEditorialFailClosedMetadata("/", page.publicContentOrigin);
  }
  if (page.blocks.length === 0) {
    return buildEditorialFailClosedMetadata("/", "seed-empty-body");
  }
  return buildCmsPageMetadata({
    pageTitle: page.title ?? null,
    slug: "",
    body: page.body,
  });
}

export default async function MarketingHome({
  searchParams,
}: {
  searchParams?: Promise<HomeSearchParams> | HomeSearchParams;
}) {
  const sp = await Promise.resolve(searchParams ?? {});
  const page = await loadPublicPageWithTrustFallback("home", { preview: isPreviewFromSearchParams(sp) });
  const blocks = page?.blocks ?? [];

  const cmsOrigin = page?.publicContentOrigin ?? "seed-no-row";

  return (
    <>
      {page ? <CmsStructuredData page={page} /> : null}
      <PageShell>
        <div
          className="lp-home flex w-full flex-col"
          data-lp-public-cms-slug="home"
          data-lp-public-cms-origin={cmsOrigin}
        >
          <CmsBlockRenderer
            blocks={blocks}
            env={ENV}
            locale={LOCALE}
            enableLivePricing
            blockWrapperClassName="w-full"
            pageCmsMeta={page?.meta ?? {}}
          />
        </div>
        <RelatedLinks currentPath="/" tags={["core", "seo", "local", "system", "alt_kantine"]} />
      </PageShell>
    </>
  );
}
