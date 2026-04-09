import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageShell from "@/components/PageShell";
import { CmsBlockRenderer } from "@/components/cms/CmsBlockRenderer";
import { buildCmsPageMetadata } from "@/lib/cms/public/cmsPageMetadata";
import { loadLivePageContent } from "@/lib/cms/public/loadLivePageContent";

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

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<SP> | SP;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sp = await Promise.resolve(searchParams ?? {});
  const content = await loadLivePageContent(slug, { preview: isPreviewFromSearchParams(sp) });
  if (!content) return { title: "Siden finnes ikke" };
  return buildCmsPageMetadata({
    pageTitle: content.title ?? null,
    slug: content.slug ?? slug,
    body: content.body,
  });
}

export default async function PublicCmsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await Promise.resolve(searchParams ?? {});
  const content = await loadLivePageContent(slug, { preview: isPreviewFromSearchParams(sp) });
  if (!content) notFound();

  const safeBlocks = content.blocks;

  return (
    <PageShell>
      <article className="lp-container mx-auto max-w-4xl px-4 py-8">
        {content.title && (
          <h1 className="lp-h1 mb-6 text-[rgb(var(--lp-text))]">
            {content.title}
          </h1>
        )}
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
        {safeBlocks.length === 0 && (
          <p className="text-slate-500">Ingen innhold å vise.</p>
        )}
      </article>
    </PageShell>
  );
}
