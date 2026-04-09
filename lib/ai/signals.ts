import "server-only";

import { withCache } from "@/lib/core/withCache";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type AggregatedSignals = {
  runs: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
};

/**
 * Deterministic aggregates from recent tracked AI events (`action` = `agent_run`, metadata from {@link persistAiTrackEvent}).
 * Fail-closed: returns zeros on read error.
 */
export async function collectSignals(): Promise<AggregatedSignals> {
  return withCache(
    "ai:signals:aggregate:v1",
    async () => {
      try {
        const supabase = supabaseAdmin();
        const { data: events, error } = await supabase
          .from("ai_activity_log")
          .select("metadata")
          .eq("action", "agent_run")
          .order("created_at", { ascending: false })
          .limit(500);

        if (error || !Array.isArray(events)) {
          return { runs: 0, conversions: 0, revenue: 0, conversionRate: 0 };
        }

        let runs = 0;
        let conversions = 0;
        let revenue = 0;

        for (const row of events as { metadata?: unknown }[]) {
          const m = row.metadata;
          if (!m || typeof m !== "object" || Array.isArray(m)) continue;
          const meta = m as Record<string, unknown>;
          const t = meta.track_event_type;

          if (t === "ai_run") runs += 1;
          if (t === "ai_conversion") {
            conversions += 1;
            const r = meta.revenue;
            revenue += typeof r === "number" && Number.isFinite(r) ? r : 0;
          }
        }

        const conversionRate = runs > 0 ? conversions / runs : 0;

        return { runs, conversions, revenue, conversionRate };
      } catch {
        return { runs: 0, conversions: 0, revenue: 0, conversionRate: 0 };
      }
    },
    { ttlMs: 30_000 },
  );
}
