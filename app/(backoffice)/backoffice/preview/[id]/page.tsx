import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageShell from "@/components/PageShell";
import { normalizeBlockForRender } from "@/lib/cms/public/normalizeBlockForRender";
import { parseBody } from "@/lib/cms/public/parseBody";
import { renderBlock } from "@/lib/public/blocks/renderBlock";
import { supabaseServer } from "@/lib/supabase/server";

// Preview uses staging env for blocks (forms, etc.) so that
// draft content issues are visible without touching prod state.
const PREVIEW_ENV: "prod" | "staging" = "staging";
const PREVIEW_LOCALE: "nb" | "en" = "nb";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
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

  // Preview is intentionally isolated: if no preview variant exists, render
  // an empty preview instead of falling back to prod.

  const body =
    variant && typeof variant === "object" && "body" in variant ? (variant as { body: unknown }).body : null;

  const blocks = parseBody(body);
  const safeBlocks = Array.isArray(blocks) ? blocks : [];

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
        {page.title && (
          <h1 className="lp-h1 mb-6 text-[rgb(var(--lp-text))]">
            {page.title as string}
          </h1>
        )}
        <div className="flex flex-col gap-6">
          {safeBlocks.map((block, i) => {
            const node = normalizeBlockForRender(block ?? null, i);
            return (
              <div key={node.id}>
                {renderBlock(node, PREVIEW_ENV, PREVIEW_LOCALE)}
              </div>
            );
          })}
        </div>
        {safeBlocks.length === 0 && (
          <p className="text-slate-500">Ingen kladd-variant å vise for denne siden.</p>
        )}
      </article>
    </PageShell>
  );
}
