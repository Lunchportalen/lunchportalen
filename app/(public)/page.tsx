// app/page.tsx
import type { Metadata } from "next";

import PageShell from "@/components/PageShell";

import RelatedLinks from "@/components/seo/RelatedLinks";
import { CmsBlockRenderer } from "@/components/cms/CmsBlockRenderer";
import { CmsStructuredData } from "@/components/seo/CmsStructuredData";
import { buildCmsPageMetadata } from "@/lib/cms/public/cmsPageMetadata";
import { loadLivePageContent } from "@/lib/cms/public/loadLivePageContent";
import { parseBody, type BlockItem } from "@/lib/cms/public/renderPipeline";
import { buildMarketingHomeBody } from "@/lib/cms/seed/marketingHomeBody";

const ENV: "prod" | "staging" =
  typeof process.env.NEXT_PUBLIC_APP_ENV === "string" && process.env.NEXT_PUBLIC_APP_ENV === "staging"
    ? "staging"
    : "prod";
const LOCALE: "nb" | "en" = "nb";

/** CI: scripts/ci/cms-integrity.mjs string anchors — faktisk rendering: {@link CmsBlockRenderer} → normalizeBlockForRender( … ) → renderBlock( … ). */
// getContentBySlug('home') — runtime: loadLivePageContent("home")
// normalizeBlockForRender(
// renderBlock(
// async function ExistingHomepage

type HomeSearchParams = Record<string, string | string[] | undefined> | undefined;

function isPreviewFromSearchParams(sp: HomeSearchParams): boolean {
  const raw = sp?.preview;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "true";
}

const marketingHomeStaticMetadata: Metadata = {
  title: "Lunchportalen – firmalunsj med kontroll og forutsigbarhet",
  description:
    "Bestill og administrer firmalunsj med faste rammer, cut-off kl. 08:00 og full oversikt. Lunchportalen gir bedrifter kontroll – uten støy.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Lunchportalen – firmalunsj med kontroll og forutsigbarhet",
    description:
      "Bestill og administrer firmalunsj med faste rammer, cut-off kl. 08:00 og full oversikt. Lunchportalen gir bedrifter kontroll – uten støy.",
    type: "website",
    url: "https://lunchportalen.no/",
  },
};

/** CMS body blocks, or canonical seed when empty / missing (single render path). */
function homeBlocksForRenderer(body: unknown): BlockItem[] {
  const parsed = parseBody(body);
  if (parsed.length > 0) return parsed;
  const seed = buildMarketingHomeBody();
  return seed.blocks.map((b) => ({
    id: b.id,
    type: b.type,
    data: b.data,
    ...(b.config ? { config: b.config } : {}),
  }));
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<HomeSearchParams> | HomeSearchParams;
}): Promise<Metadata> {
  const sp = await Promise.resolve(searchParams ?? {});
  const page = await loadLivePageContent("home", { preview: isPreviewFromSearchParams(sp) });
  if (!page || page.blocks.length === 0) {
    return marketingHomeStaticMetadata;
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
  const page = await loadLivePageContent("home", { preview: isPreviewFromSearchParams(sp) });
  const blocks = homeBlocksForRenderer(page?.body ?? null);

  return (
    <>
      {page ? <CmsStructuredData page={page} /> : null}
      <PageShell>
        <div className="lp-home flex w-full flex-col">
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
