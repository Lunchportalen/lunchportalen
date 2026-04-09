// lib/db/profileLookup.ts
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

export async function loadProfileByUserId(
  sb: SupabaseClient<Database>,
  userId: string,
  select: string
): Promise<{ data: Record<string, unknown> | null; error: PostgrestError | null }> {
  const byId = await sb.from("profiles").select(select).eq("id", userId).maybeSingle();
  if (byId?.data || byId?.error) {
    return {
      data: byId.data == null ? null : (byId.data as unknown as Record<string, unknown>),
      error: byId.error,
    };
  }
  const byUser = await sb.from("profiles").select(select).eq("user_id", userId).maybeSingle();
  return {
    data: byUser.data == null ? null : (byUser.data as unknown as Record<string, unknown>),
    error: byUser.error,
  };
}
