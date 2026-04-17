/**
 * Internal: Supabase `content_pages` + `content_page_variants` read — **not** public editorial truth.
 * Used by backoffice/admin bridges and tests; public marketing routes use Umbraco via {@link getContentBySlug}.
 */
import "server-only";

import type { ContentBySlugResult, GetContentBySlugOptions } from "@/lib/cms/public/getContentBySlug";

export async function readSupabasePublishedContentPageBySlug(
  slug: string,
  options?: GetContentBySlugOptions,
): Promise<ContentBySlugResult | null> {
  if (!slug || typeof slug !== "string") return null;
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = supabaseAdmin();
  const { data: page, error: pageError } = await supabase
    .from("content_pages")
    .select("id, slug, title, status")
    .eq("slug", normalized)
    .eq("status", "published")
    .maybeSingle();
  if (pageError || !page?.id) return null;
  const environment = options?.preview === true ? "preview" : "prod";
  const { data: variant, error: variantError } = await supabase
    .from("content_page_variants")
    .select("id, body")
    .eq("page_id", page.id)
    .eq("locale", "nb")
    .eq("environment", environment)
    .maybeSingle();
  if (variantError || !variant) return null;
  const body = variant.body ?? null;

  const { overlayRunningExperimentOnBody } = await import("@/lib/experiments/overlayRunningExperiment");
  const overlaid = await overlayRunningExperimentOnBody({
    pageId: page.id,
    baseBody: body,
    preview: options?.preview === true,
    experimentSubjectKey: options?.experimentSubjectKey,
    experimentUseRandomSplit: options?.experimentUseRandomSplit === true,
  });

  return {
    pageId: page.id,
    slug: String(page.slug ?? normalized),
    title: page.title ?? null,
    body: overlaid.body,
    experimentAssignment: overlaid.assignment ?? null,
    publicContentOrigin: "live-supabase",
  };
}
