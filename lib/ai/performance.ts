import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type PromptPerformanceRow = {
  runs: number;
  conversions: number;
  revenue: number;
};

/**
 * Aggregate runs / conversions / revenue per `metadata.prompt_key` from tracked `agent_run` rows.
 * Uses `metadata.track_event_type` (not legacy `event_type` / `key` columns).
 */
export async function getPromptPerformance(): Promise<Record<string, PromptPerformanceRow>> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_activity_log")
      .select("metadata")
      .eq("action", "agent_run")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error || !Array.isArray(data)) return {};

    const map: Record<string, PromptPerformanceRow> = {};

    for (const row of data as { metadata?: unknown }[]) {
      const m = row.metadata;
      if (!m || typeof m !== "object" || Array.isArray(m)) continue;
      const meta = m as Record<string, unknown>;
      const t = meta.track_event_type;
      const keyRaw = typeof meta.prompt_key === "string" ? meta.prompt_key.trim() : "";
      const bucket = keyRaw || "unknown";

      if (!map[bucket]) {
        map[bucket] = { runs: 0, conversions: 0, revenue: 0 };
      }

      if (t === "ai_run") map[bucket].runs += 1;
      if (t === "ai_conversion") {
        map[bucket].conversions += 1;
        const r = meta.revenue;
        map[bucket].revenue += typeof r === "number" && Number.isFinite(r) ? r : 0;
      }
    }

    return map;
  } catch {
    return {};
  }
}
