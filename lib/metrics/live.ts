import "server-only";

import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type LiveOrderMetrics = {
  revenue: number;
  orders: number;
};

/**
 * Platform-wide order totals (service role). Intended only when explicitly enabled for pitch/sales flows.
 * Fail-closed: errors → zeros (never throws).
 */
export async function getLiveMetrics(): Promise<LiveOrderMetrics> {
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin.from("orders").select("line_total").limit(50_000);
    if (error || !Array.isArray(data)) {
      opsLog("live_metrics_orders_read_failed", { message: error?.message ?? "no_data" });
      return { revenue: 0, orders: 0 };
    }

    let revenue = 0;
    for (const row of data) {
      const lt = row && typeof row === "object" ? (row as { line_total?: unknown }).line_total : undefined;
      if (typeof lt === "number" && Number.isFinite(lt)) revenue += lt;
      else if (typeof lt === "string" && lt.trim()) {
        const n = Number(lt);
        if (Number.isFinite(n)) revenue += n;
      }
    }

    return { revenue, orders: data.length };
  } catch (e) {
    opsLog("live_metrics_exception", { message: e instanceof Error ? e.message : String(e) });
    return { revenue: 0, orders: 0 };
  }
}
