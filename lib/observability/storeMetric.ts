import "server-only";

import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function storeMetric(metric: string, value: number): Promise<void> {
  const name = String(metric ?? "").trim();
  if (!name || !Number.isFinite(value)) return;
  try {
    const supabase = supabaseAdmin();
    const { error } = await supabase.from("ai_metrics_history").insert({
      metric_name: name,
      value,
    });
    if (error) {
      opsLog("metrics_history_store_failed", { metric: name, error: error.message });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    opsLog("metrics_history_store_failed", { metric: name, error: message });
  }
}
