import "server-only";

import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

const HISTORY_LIMIT = 50;

export async function loadMetricHistory(metric: string): Promise<number[]> {
  const name = String(metric ?? "").trim();
  if (!name) return [];
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_metrics_history")
      .select("value")
      .eq("metric_name", name)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    if (error) {
      opsLog("metrics_history_load_failed", { metric: name, error: error.message });
      return [];
    }
    return (data ?? []).map((d) => Number((d as { value?: unknown }).value)).filter((n) => Number.isFinite(n));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    opsLog("metrics_history_load_failed", { metric: name, error: message });
    return [];
  }
}
