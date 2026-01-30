// lib/audit/idempotency.ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureIdempotent(
  sb: SupabaseClient,
  rid: string,
  action: string,
  entityType: string,
  entityId: string
) {
  const { data, error } = await sb
    .from("audit_meta_events")
    .select("id")
    .eq("rid", rid)
    .eq("action", action)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .limit(1);

  if (error) throw error;
  if (data && data.length > 0) {
    return { ok: false as const };
  }
  return { ok: true as const };
}
