import "server-only";

import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ATTRIBUTION_FETCH_LIMIT = 500;

export async function getAttributionData(): Promise<unknown[]> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_memory")
      .select("*")
      .eq("kind", "attribution_cycle")
      .order("created_at", { ascending: false })
      .limit(ATTRIBUTION_FETCH_LIMIT);
    if (error) {
      opsLog("attribution_query_failed", { error: error.message });
      return [];
    }
    return data ?? [];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    opsLog("attribution_query_failed", { error: message });
    return [];
  }
}
