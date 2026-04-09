import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageShell from "@/components/PageShell";
import { CmsBlockRenderer } from "@/components/cms/CmsBlockRenderer";
import { parseBody, parseBodyMeta } from "@/lib/cms/public/renderPipeline";
import { getLocalCmsPageDetail, isLocalCmsRuntimeError } from "@/lib/localRuntime/cmsProvider";
import { isLocalCmsRuntimeEnabled } from "@/lib/localRuntime/runtime";
import { supabaseServer } from "@/lib/supabase/server";

// Preview uses staging env for blocks (forms, etc.) so that
// draft content issues are visible without touching prod state.
const PREVIEW_ENV: "prod" | "staging" = "staging";
const PREVIEW_LOCALE: "nb" | "en" = "nb";

type Props = { params: Promise<{ id: string }> };

function renderPreviewPage(params: {
  title?: string | null;
  blocks: unknown[];
  pageCmsMeta: ReturnType<typeof parseBodyMeta>;
  missingMessage?: string | null;
}) {
  const safeBlocks = Array.isArray(params.blocks) ? params.blocks : [];
  return (
    <PageShell>
      <div
        className="sticky top-0 z-10 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900"
        role="status"
        aria-live="polite"
      >
        Forhåndsvisning av kladd — dette er ikke publisert innhold
      </div>
      <article className="lp-container mx-auto max-w-4xl px-4 py-8">
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-500">Forhåndsvisning (kladd)</p>
        {params.title && (
          <h1 className="lp-h1 mb-6 text-[rgb(var(--lp-text))]">
            {params.title}
          </h1>
        )}
        {params.missingMessage ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            {params.missingMessage}
          </div>
        ) : null}
        <div className="mt-6 flex flex-col gap-6">
          <CmsBlockRenderer
            blocks={safeBlocks}
            env={PREVIEW_ENV}
            locale={PREVIEW_LOCALE}
            enableLivePricing
            blockWrapperClassName="w-full"
            pageCmsMeta={params.pageCmsMeta}
          />
        </div>
      </article>
    </PageShell>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  if (isLocalCmsRuntimeEnabled()) {
    try {
      const page = getLocalCmsPageDetail({ pageId: id, locale: PREVIEW_LOCALE, environment: "preview" });
      const title = page.title?.trim() || "Forhåndsvisning";
      return {
        title: `${title} – Forhåndsvisning – Lunchportalen`,
        robots: { index: false, follow: false },
      };
    } catch (error) {
      if (isLocalCmsRuntimeError(error) && error.status === 404) {
        return { title: "Forhåndsvisning – Lunchportalen" };
      }
      return { title: "Forhåndsvisning – Lunchportalen" };
    }
  }

  const supabase = await supabaseServer();
  const { data: page } = await supabase.from("content_pages").select("title, slug").eq("id", id).single();
  if (!page) return { title: "Forhåndsvisning – Lunchportalen" };
  const title = (page.title as string)?.trim() || "Forhåndsvisning";
  return {
    title: `${title} – Forhåndsvisning – Lunchportalen`,
    robots: { index: false, follow: false },
  };
}

/**
 * Backoffice draft preview: identical rendering pipeline to public [slug].
 * Uses parseBody (lib/cms/public/parseBody) → normalizeBlockForRender → renderBlock.
 * Only divergence: PREVIEW_ENV = "staging" so draft issues (e.g. unknown block types) are visible.
 */
export default async function BackofficePreviewPage({ params }: Props) {
  const { id } = await params;

  if (isLocalCmsRuntimeEnabled()) {
    try {
      const page = getLocalCmsPageDetail({ pageId: id, locale: PREVIEW_LOCALE, environment: "preview" });
      const body = page.body ?? null;
      const blocks = parseBody(body);
      const pageCmsMeta = parseBodyMeta(body);
      return renderPreviewPage({ title: page.title, blocks, pageCmsMeta });
    } catch (error) {
      if (isLocalCmsRuntimeError(error) && error.code === "VARIANT_NOT_FOUND") {
        return renderPreviewPage({
          title: "Forhåndsvisning",
          blocks: [],
          pageCmsMeta: parseBodyMeta(null),
          missingMessage: "Denne siden mangler preview-variant for nb/preview.",
        });
      }
      if (isLocalCmsRuntimeError(error) && error.status === 404) {
        notFound();
      }
      throw error;
    }
  }

  const supabase = await supabaseServer();

  const { data: page, error: pageErr } = await supabase
    .from("content_pages")
    .select("id, title, slug")
    .eq("id", id)
    .single();

  if (pageErr || !page) notFound();

  const { data: previewVariant, error: previewErr } = await supabase
    .from("content_page_variants")
    .select("body, environment")
    .eq("page_id", id)
    .eq("locale", "nb")
    .eq("environment", "preview")
    .maybeSingle();

  if (previewErr) notFound();

  const variant = previewVariant;

  const body =
    variant && typeof variant === "object" && "body" in variant ? (variant as { body: unknown }).body : null;

  const blocks = parseBody(body);
  const pageCmsMeta = parseBodyMeta(body);
  const missingMessage = previewVariant
    ? null
    : `Denne siden mangler preview-variant for ${PREVIEW_LOCALE}/preview.`;

  return renderPreviewPage({
    title: page.title as string,
    blocks,
    pageCmsMeta,
    missingMessage,
  });
}
