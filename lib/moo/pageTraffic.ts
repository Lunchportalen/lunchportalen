import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const WINDOW_DAYS = 7;

/**
 * Count prod page_view events for impact / cooldown / exploration (deterministic window).
 */
export async function countPageViewsLastDays(supabase: SupabaseClient, pageId: string, days = WINDOW_DAYS): Promise<number> {
  const pid = String(pageId ?? "").trim();
  if (!pid) return 0;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("content_analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("page_id", pid)
    .eq("event_type", "page_view")
    .eq("environment", "prod")
    .gte("created_at", since);
  if (error) return 0;
  return typeof count === "number" ? count : 0;
}
