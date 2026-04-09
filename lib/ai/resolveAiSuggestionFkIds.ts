/**
 * Maps editor-supplied page/variant ids to FK-safe values for public.ai_suggestions.
 *
 * Local CMS reserve pages (in-memory) use stable UUIDs that are not guaranteed to exist in
 * Postgres content_pages — a direct insert would raise a foreign key violation
 * (SUGGESTION_INSERT_FAILED). When absent in DB, FK columns are stored as null and the original
 * ids are copied into trace_* fields merged into the persisted input jsonb for auditability.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { isMediaItemUuid } from "@/lib/media/ids";

export type AiSuggestionFkResolution = {
  page_id: string | null;
  variant_id: string | null;
  /** Merged into ai_suggestions.input when non-empty */
  inputTrace: Record<string, unknown>;
};

export async function resolveAiSuggestionFkIds(
  supabase: SupabaseClient,
  rawPageId: unknown,
  rawVariantId: unknown,
): Promise<AiSuggestionFkResolution> {
  const pageUuid = isMediaItemUuid(rawPageId) ? String(rawPageId).trim() : null;
  const variantUuid = isMediaItemUuid(rawVariantId) ? String(rawVariantId).trim() : null;
  const inputTrace: Record<string, unknown> = {};

  let page_id: string | null = pageUuid;
  let variant_id: string | null = variantUuid;

  if (pageUuid) {
    const { data, error } = await supabase.from("content_pages").select("id").eq("id", pageUuid).maybeSingle();
    if (error || !data?.id) {
      page_id = null;
      inputTrace.trace_page_id = pageUuid;
    }
  }

  if (variantUuid) {
    const { data, error } = await supabase
      .from("content_page_variants")
      .select("id")
      .eq("id", variantUuid)
      .maybeSingle();
    if (error || !data?.id) {
      variant_id = null;
      inputTrace.trace_variant_id = variantUuid;
    }
  }

  // Page missing in Postgres (e.g. local reserve): do not keep a variant FK that could imply a different persisted page graph.
  if (inputTrace.trace_page_id && variant_id) {
    inputTrace.trace_variant_id_cleared = variant_id;
    variant_id = null;
  }

  return { page_id, variant_id, inputTrace };
}
