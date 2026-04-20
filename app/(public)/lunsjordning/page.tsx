// Editorial HTML + SEO via Umbraco Delivery — Next = renderer only.
// scripts/seo-proof.mjs statically analyzes THIS file for JSON-LD, single H1 tag, and primaryCta href pattern.
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PageShell from "@/components/PageShell";
import { CmsBlockRenderer } from "@/components/cms/CmsBlockRenderer";
import { buildPublicCmsJsonLdGraph } from "@/components/seo/CmsStructuredData";
import { EDITORIAL_FAIL_CLOSED_DESCRIPTION } from "@/lib/cms/public/editorialFailClosedMetadata";
import { canonicalPathForPublicEditorialSlug } from "@/lib/cms/public/canonicalPathForPublicEditorialSlug";
import { loadPublicPageWithTrustFallback } from "@/lib/cms/public/loadPublicPageWithTrustFallback";
import { generatePublicCmsSlugMetadata } from "@/lib/cms/public/publicCmsSlugRoute";
import { MARKETING_REGISTRY } from "@/lib/seo/marketingRegistry";

const SLUG = "lunsjordning";

const ENV: "prod" | "staging" =
  typeof process.env.NEXT_PUBLIC_APP_ENV === "string" && process.env.NEXT_PUBLIC_APP_ENV === "staging"
    ? "staging"
    : "prod";
const LOCALE: "nb" | "en" = "nb";

type SP = Record<string, string | string[] | undefined> | undefined;
type Props = { searchParams?: Promise<SP> | SP };

function isPreviewFromSearchParams(sp: SP): boolean {
  const raw = sp?.preview;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "true";
}

const primaryCta = MARKETING_REGISTRY["/lunsjordning"].primaryCta!;

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return generatePublicCmsSlugMetadata(SLUG, searchParams);
}

export default async function LunsjordningPage({ searchParams }: Props) {
  const sp = await Promise.resolve(searchParams ?? {});
  const content = await loadPublicPageWithTrustFallback(SLUG, { preview: isPreviewFromSearchParams(sp) });
  if (!content) notFound();

  const safeBlocks = content.blocks;
  const canonicalPath = canonicalPathForPublicEditorialSlug(content.slug);
  const registryEntry = MARKETING_REGISTRY["/lunsjordning"];
  const pageTitle = (content.title && content.title.trim()) || registryEntry.title;
  const jsonLdGraph = buildPublicCmsJsonLdGraph(
    { title: content.title, slug: content.slug, body: content.body },
    canonicalPath,
  );

  return (
    <PageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
      />
      <article
        className="lp-container mx-auto max-w-4xl px-4 py-8"
        data-lp-public-cms-slug={content.slug}
        data-lp-public-cms-origin={content.publicContentOrigin}
      >
        <h1 className="lp-h1 mb-6 text-[rgb(var(--lp-text))]">{pageTitle}</h1>
        <div className="mb-6 flex flex-wrap gap-3">
          <Link href={primaryCta.href} className="lp-btn lp-btn-primary">
            {primaryCta.label}
          </Link>
        </div>
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
