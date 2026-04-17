// app/(auth)/registrering/page.tsx — editorial shell + metadata from Umbraco when Delivery serves content; form → Supabase (operational truth).
import type { Metadata } from "next";
import { Suspense } from "react";

import PageShell from "@/components/PageShell";
import { CmsBlockRenderer } from "@/components/cms/CmsBlockRenderer";
import PublicRegistrationFlow from "@/components/registration/PublicRegistrationFlow";
import { PublicCmsStructuredData } from "@/components/seo/CmsStructuredData";
import { canonicalPathForPublicEditorialSlug } from "@/lib/cms/public/canonicalPathForPublicEditorialSlug";
import {
  generatePublicCmsSlugMetadata,
} from "@/lib/cms/public/publicCmsSlugRoute";
import { EDITORIAL_FAIL_CLOSED_DESCRIPTION } from "@/lib/cms/public/editorialFailClosedMetadata";
import { loadPublicPageWithTrustFallback } from "@/lib/cms/public/loadPublicPageWithTrustFallback";

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
  return generatePublicCmsSlugMetadata("registrering", searchParams);
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function LoadingShell() {
  return (
    <main className="min-h-[70vh] w-full">
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <div className="rounded-2xl border bg-white/70 p-6 shadow-sm">
          <div className="h-6 w-48 animate-pulse rounded bg-black/10" />
          <div className="mt-4 h-4 w-full animate-pulse rounded bg-black/10" />
          <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-black/10" />
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="h-12 animate-pulse rounded-xl bg-black/10" />
            <div className="h-12 animate-pulse rounded-xl bg-black/10" />
            <div className="h-12 animate-pulse rounded-xl bg-black/10" />
            <div className="h-12 animate-pulse rounded-xl bg-black/10" />
          </div>
          <div className="mt-6 h-12 w-40 animate-pulse rounded-xl bg-black/10" />
        </div>
      </div>
    </main>
  );
}

export default async function RegistrationPage({
  searchParams,
}: {
  searchParams?: Promise<SP> | SP;
}) {
  const sp = await Promise.resolve(searchParams ?? {});
  const content = await loadPublicPageWithTrustFallback("registrering", { preview: isPreviewFromSearchParams(sp) });
  const blocks = content?.blocks ?? [];
  const cmsOrigin = content?.publicContentOrigin ?? "seed-no-row";

  return (
    <>
      {content ? (
        <PublicCmsStructuredData
          page={{ title: content.title, slug: content.slug, body: content.body }}
          canonicalPath={canonicalPathForPublicEditorialSlug("registrering")}
        />
      ) : null}
      <PageShell>
      <div
        className="lp-container mx-auto max-w-5xl px-4 py-7 sm:py-9"
        data-lp-public-cms-slug="registrering"
        data-lp-public-cms-origin={cmsOrigin}
      >
        {content?.title ? (
          <header className="mb-6">
            <h1 className="lp-h1 mb-2 text-[rgb(var(--lp-text))]">{content.title}</h1>
          </header>
        ) : null}
        {blocks.length > 0 ? (
          <div className="mb-8 flex flex-col gap-6">
            <CmsBlockRenderer
              blocks={blocks}
              env={ENV}
              locale={LOCALE}
              enableLivePricing={false}
              blockWrapperClassName="w-full"
              pageCmsMeta={content?.meta ?? {}}
            />
          </div>
        ) : cmsOrigin === "seed-no-row" || cmsOrigin === "seed-empty-body" ? (
          <p className="mb-6 text-sm text-slate-600">{EDITORIAL_FAIL_CLOSED_DESCRIPTION}</p>
        ) : null}
        <Suspense fallback={<LoadingShell />}>
          <PublicRegistrationFlow />
        </Suspense>
      </div>
    </PageShell>
    </>
  );
}
