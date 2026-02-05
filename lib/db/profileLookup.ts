// lib/db/profileLookup.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadProfileByUserId(
  sb: SupabaseClient,
  userId: string,
  select: string
): Promise<{ data: any; error: any }> {
  const byId = await (sb as any).from("profiles").select(select).eq("id", userId).maybeSingle();
  if (byId?.data || byId?.error) return byId;
  return await (sb as any).from("profiles").select(select).eq("user_id", userId).maybeSingle();
}
