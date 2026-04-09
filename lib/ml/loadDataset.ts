import "server-only";

import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

import type { MetricRow } from "./dataset";

const FETCH_LIMIT = 5000;
const MAX_ROWS = 500;

type HistoryRow = {
  metric_name?: string | null;
  value?: unknown;
  created_at?: string | null;
};

/**
 * Pivots `ai_metrics_history` (long format) into aligned wide rows by taking the last N
 * samples per metric and zipping by index (same insert order per cron).
 */
export async function loadDataset(): Promise<MetricRow[]> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_metrics_history")
      .select("metric_name, value, created_at")
      .order("created_at", { ascending: true })
      .limit(FETCH_LIMIT);

    if (error) {
      opsLog("ml_dataset_load_failed", { message: error.message });
      return [];
    }

    const groups: Record<string, { t: number; v: number }[]> = {};
    for (const row of (data ?? []) as HistoryRow[]) {
      const name = String(row.metric_name ?? "").trim();
      if (!name) continue;
      const t = row.created_at ? Date.parse(String(row.created_at)) : NaN;
      const v = Number(row.value);
      if (!Number.isFinite(t) || !Number.isFinite(v)) continue;
      if (!groups[name]) groups[name] = [];
      groups[name].push({ t, v });
    }

    const need = ["conversion", "traffic", "revenue", "churn"] as const;
    const lengths = need.map((n) => Math.min(groups[n]?.length ?? 0, MAX_ROWS));
    const n = Math.min(...lengths);
    if (n < 1) {
      opsLog("ml_dataset_empty", { reason: "insufficient_aligned_series" });
      return [];
    }

    const rows: MetricRow[] = [];
    for (let i = 0; i < n; i++) {
      const pick = (name: (typeof need)[number], arr: { t: number; v: number }[]) => {
        const idx = arr.length - n + i;
        return arr[idx];
      };
      const c = pick("conversion", groups.conversion!);
      const tr = pick("traffic", groups.traffic!);
      const rev = pick("revenue", groups.revenue!);
      const ch = pick("churn", groups.churn!);
      rows.push({
        ts: c.t,
        conversion: c.v,
        traffic: tr.v,
        revenue: rev.v,
        churn: ch.v,
      });
    }
    opsLog("ml_dataset_loaded", { rows: rows.length });
    return rows;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    opsLog("ml_dataset_load_failed", { message });
    return [];
  }
}
