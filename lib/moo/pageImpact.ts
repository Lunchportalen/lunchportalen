import "server-only";

import { countPageViewsLastDays } from "@/lib/moo/pageTraffic";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PageImpactRow = {
  pageId: string;
  slug: string;
  pageViews7d: number;
};

/**
 * Ranks published pages by 7d prod traffic (for prioritizing high-impact experiments). Deterministic ordering.
 */
export async function rankPublishedPagesByTraffic7d(supabase: SupabaseClient, limit = 30): Promise<PageImpactRow[]> {
  const { data: pages, error } = await supabase
    .from("content_pages")
    .select("id,slug")
    .eq("status", "published")
    .limit(200);
  if (error || !pages?.length) return [];

  const rows: PageImpactRow[] = [];
  for (const p of pages) {
    const pageId = String((p as { id?: string }).id ?? "").trim();
    const slug = String((p as { slug?: string }).slug ?? "").trim();
    if (!pageId) continue;
    const pageViews7d = await countPageViewsLastDays(supabase, pageId, 7);
    rows.push({ pageId, slug, pageViews7d });
  }

  rows.sort((a, b) => b.pageViews7d - a.pageViews7d);
  return rows.slice(0, Math.max(1, limit));
}
