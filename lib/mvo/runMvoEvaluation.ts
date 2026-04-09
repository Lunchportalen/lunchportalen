import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { persistStrategyBoosts } from "@/lib/learning/boosts";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { OrderLike } from "./metrics";
import { buildPerformanceMap } from "./performanceMemory";
import { promoteCombo } from "./promote";
import { EXPLORATION_FRACTION_DENOMINATOR, MAX_NEW_COMBOS_PER_CRON, ROLLBACK_REVENUE_RATIO } from "./safety";
import { pickBestCombo } from "./winner";

import { opsLog } from "@/lib/ops/log";

const ROUTE = "run_mvo_evaluation";

export type MvoEvaluationSummary = {
  ordersSampled: number;
  combosMeasured: number;
  bestKey: string | null;
  bestRevenue: number;
  promoted: ReturnType<typeof promoteCombo>;
  rollbackSkipped: boolean;
  logged: boolean;
};

function numMeta(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

async function loadPreviousBestRevenue(admin: SupabaseClient): Promise<number | null> {
  const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
  if (!ok) return null;
  const { data, error } = await admin
    .from("ai_activity_log")
    .select("metadata")
    .eq("action", "mvo_learning")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data || typeof data !== "object") return null;
  const m = (data as { metadata?: unknown }).metadata;
  if (!m || typeof m !== "object" || Array.isArray(m)) return null;
  const best = (m as Record<string, unknown>).best_revenue;
  const n = numMeta(best);
  return n > 0 ? n : null;
}

/**
 * Leser ordre med MVO-felt, måler omsetning per combo, velger vinner, logger `mvo_learning`,
 * og øker strategivekt ved suksess (hopper over ved rollback-signal).
 */
export async function runMvoEvaluation(admin: SupabaseClient, rid: string): Promise<MvoEvaluationSummary> {
  const ok = await verifyTable(admin, "orders", ROUTE);
  if (!ok) {
    return {
      ordersSampled: 0,
      combosMeasured: 0,
      bestKey: null,
      bestRevenue: 0,
      promoted: null,
      rollbackSkipped: false,
      logged: false,
    };
  }

  const { data: rows, error } = await admin
    .from("orders")
    .select("variant_channel, variant_segment, variant_timing, line_total, total_amount, market_id")
    .limit(12_000);

  if (error || !Array.isArray(rows)) {
    opsLog("mvo_orders_fetch_failed", { rid, message: error?.message });
    return {
      ordersSampled: 0,
      combosMeasured: 0,
      bestKey: null,
      bestRevenue: 0,
      promoted: null,
      rollbackSkipped: false,
      logged: false,
    };
  }

  const orders = rows as OrderLike[];
  const marketIds = new Set(
    orders
      .map((o) => (typeof o.market_id === "string" && o.market_id.trim() ? o.market_id.trim() : null))
      .filter((x): x is string => x != null)
  );
  const marketHint =
    marketIds.size === 1 ? [...marketIds][0]! : marketIds.size > 1 ? "mixed" : "default";

  const withDims = orders.filter(
    (o) =>
      (o.variant_channel != null && String(o.variant_channel).trim() !== "") ||
      (o.variant_segment != null && String(o.variant_segment).trim() !== "") ||
      (o.variant_timing != null && String(o.variant_timing).trim() !== "")
  );

  const metrics = buildPerformanceMap(withDims.length ? withDims : orders);
  const best = pickBestCombo(metrics);
  const promoted = promoteCombo(best);
  const bestRevenue = best ? best[1].revenue : 0;
  const bestKey = best ? best[0] : null;

  const prevBest = await loadPreviousBestRevenue(admin);
  const rollbackSkipped =
    prevBest != null && bestRevenue > 0 && bestRevenue < prevBest * ROLLBACK_REVENUE_RATIO;

  if (rollbackSkipped) {
    opsLog("mvo_rollback_signal", { rid, bestRevenue, prevBest, ratio: ROLLBACK_REVENUE_RATIO });
  } else if (bestRevenue > 0 && promoted?.channel) {
    await persistStrategyBoosts(admin, {
      rid,
      boosts: { [`mvo_channel_${promoted.channel}`]: 1.02 },
    });
  }

  const row = buildAiActivityLogRow({
    action: "mvo_learning",
    metadata: {
      kind: "mvo_eval",
      rid,
      market_id: marketHint,
      combo: bestKey,
      revenue: bestRevenue,
      best_revenue: bestRevenue,
      order_count: best ? best[1].count : 0,
      promoted,
      performance_map: metrics,
      metrics,
      routing: {
        best_key: bestKey,
        exploration_denominator: EXPLORATION_FRACTION_DENOMINATOR,
        max_new_combos_per_cron: MAX_NEW_COMBOS_PER_CRON,
        note: "Exploration ~20% via explore.ts; never force 100% to one arm.",
      },
      rollback_skipped: rollbackSkipped,
      prev_best_revenue: prevBest,
    },
  });

  const logOk = await verifyTable(admin, "ai_activity_log", ROUTE);
  let logged = false;
  if (logOk) {
    const { error: insErr } = await admin.from("ai_activity_log").insert({
      ...row,
      rid,
      status: "success",
    } as Record<string, unknown>);
    if (insErr) {
      opsLog("mvo_learning_insert_failed", { rid, message: insErr.message });
    } else {
      logged = true;
    }
  }

  opsLog("mvo_eval_summary", {
    rid,
    combosMeasured: Object.keys(metrics).length,
    bestKey,
    rollbackSkipped,
  });

  return {
    ordersSampled: orders.length,
    combosMeasured: Object.keys(metrics).length,
    bestKey,
    bestRevenue,
    promoted,
    rollbackSkipped,
    logged,
  };
}
