/**
 * Server-only: resolve CMS page + variant body by slug for public rendering.
 */
export type ContentBySlugResult = {
  pageId: string;
  slug: string;
  title: string | null;
  body: unknown;
};

export async function getContentBySlug(slug: string): Promise<ContentBySlugResult | null> {
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
  // Public route shows published content only: prod variant for default locale.
  const { data: variant, error: variantError } = await supabase
    .from("content_page_variants")
    .select("id, body")
    .eq("page_id", page.id)
    .eq("locale", "nb")
    .eq("environment", "prod")
    .maybeSingle();
  if (variantError || !variant) return null;
  const body = variant.body ?? null;
  return { pageId: page.id, slug: String(page.slug ?? normalized), title: page.title ?? null, body };
}
