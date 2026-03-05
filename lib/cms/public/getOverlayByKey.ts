import "server-only";
import type { BlockNode } from "@/lib/cms/model/blockTypes";

export type GetOverlayOptions = { locale?: string; environment?: string };

export type GetOverlayResult =
  | { ok: true; blocks: BlockNode[] }
  | { ok: false; reason: string };

export async function getOverlayBySlug(
  slug: string,
  options: GetOverlayOptions = {}
): Promise<GetOverlayResult> {
  if (!slug || typeof slug !== "string") return { ok: false, reason: "missing_slug" };
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return { ok: false, reason: "empty_slug" };

  const locale = options.locale ?? "nb";
  const environment = options.environment ?? "prod";

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = supabaseAdmin();

  const { data: page, error: pageError } = await supabase
    .from("content_pages")
    .select("id")
    .eq("slug", normalized)
    .maybeSingle();
  if (pageError || !page?.id) return { ok: false, reason: "page_not_found" };

  const { data: variantByLocale } = await supabase
    .from("content_page_variants")
    .select("id, body")
    .eq("page_id", page.id)
    .eq("locale", locale)
    .eq("environment", environment)
    .maybeSingle();

  let body: unknown = variantByLocale?.body ?? null;
  if (!body) {
    const { data: fallback } = await supabase
      .from("content_page_variants")
      .select("id, body")
      .eq("page_id", page.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    body = fallback?.body ?? null;
  }
  if (body === null || body === undefined) return { ok: false, reason: "no_variant" };

  if (typeof body !== "object" || Array.isArray(body)) return { ok: false, reason: "invalid_body" };
  const obj = body as Record<string, unknown>;
  if (obj.version !== 1 || !Array.isArray(obj.blocks)) return { ok: false, reason: "invalid_blocklist" };

  const blocks = (obj.blocks as unknown[]).filter(
    (b): b is BlockNode =>
      b != null &&
      typeof b === "object" &&
      typeof (b as Record<string, unknown>).id === "string" &&
      typeof (b as Record<string, unknown>).type === "string"
  );
  return { ok: true, blocks };
}
