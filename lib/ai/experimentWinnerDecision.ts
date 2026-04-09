import "server-only";

import { createHash } from "node:crypto";

import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Minimum impressions (view + impression) per variant before a winner is eligible. */
export const EXPERIMENT_MIN_IMPRESSIONS_FOR_WINNER = 50;

export type ExperimentVariantPickMetrics = {
  impressions: number;
  conversions: number;
  rate: number;
  revenueTotal: number;
  revenuePerImpression: number;
};

export type PickWinnerResult =
  | {
      ok: true;
      experimentId: string;
      winnerVariantId: string;
      byVariant: Record<string, ExperimentVariantPickMetrics>;
      reason: string;
    }
  | { ok: false; experimentId: string; reason: string };

function countImpression(eventType: string): boolean {
  return eventType === "view" || eventType === "impression";
}

/**
 * Deterministic winner: when any variant has experiment_revenue rows, uses revenue / impressions
 * (revenue per impression) among variants with n≥min impressions; otherwise conversion rate.
 */
export async function pickWinner(experimentId: string): Promise<PickWinnerResult> {
  const eid = String(experimentId ?? "").trim();
  if (!eid) {
    return { ok: false, experimentId: "", reason: "Missing experimentId" };
  }

  const supabase = supabaseAdmin();

  const { data: exp, error: eErr } = await supabase.from("experiments").select("id,status").eq("id", eid).maybeSingle();
  if (eErr) {
    opsLog("experiment.pick_winner.error", { experimentId: eid, phase: "load_experiment", message: eErr.message });
    return { ok: false, experimentId: eid, reason: eErr.message };
  }
  if (!exp) {
    opsLog("experiment.pick_winner.error", { experimentId: eid, phase: "load_experiment", message: "not_found" });
    return { ok: false, experimentId: eid, reason: "Experiment not found" };
  }
  if ((exp as { status: string }).status !== "running") {
    opsLog("experiment.pick_winner.skip_not_running", { experimentId: eid, status: (exp as { status: string }).status });
    return { ok: false, experimentId: eid, reason: "Experiment is not running" };
  }

  const { data: variantRows, error: vErr } = await supabase
    .from("experiment_variants")
    .select("variant_id")
    .eq("experiment_id", eid);
  if (vErr || !variantRows?.length) {
    opsLog("experiment.pick_winner.error", { experimentId: eid, phase: "variants", message: vErr?.message ?? "none" });
    return { ok: false, experimentId: eid, reason: vErr?.message ?? "No variants" };
  }

  const variantIds = variantRows.map((r) => String((r as { variant_id: string }).variant_id ?? "")).filter(Boolean);
  const stats = new Map<string, { impressions: number; conversions: number }>();
  for (const vid of variantIds) stats.set(vid, { impressions: 0, conversions: 0 });

  const { data: events, error: evErr } = await supabase
    .from("experiment_events")
    .select("variant_id,event_type")
    .eq("experiment_id", eid);
  if (evErr) {
    opsLog("experiment.pick_winner.error", { experimentId: eid, phase: "events", message: evErr.message });
    return { ok: false, experimentId: eid, reason: evErr.message };
  }

  for (const raw of events ?? []) {
    const row = raw as { variant_id?: string; event_type?: string };
    const vid = String(row.variant_id ?? "");
    const et = String(row.event_type ?? "");
    if (!vid || !stats.has(vid)) continue;
    const s = stats.get(vid)!;
    if (countImpression(et)) s.impressions += 1;
    if (et === "conversion") s.conversions += 1;
  }

  const revenueByVariant = new Map<string, number>();
  const { data: revRows, error: revErr } = await supabase
    .from("experiment_revenue")
    .select("variant_id,revenue")
    .eq("experiment_id", eid);
  if (revErr) {
    opsLog("experiment.pick_winner.revenue_read_error", { experimentId: eid, message: revErr.message });
  }
  for (const raw of revRows ?? []) {
    const row = raw as { variant_id?: string; revenue?: unknown };
    const vid = String(row.variant_id ?? "");
    const amt = Number(row.revenue ?? 0);
    if (!vid || !stats.has(vid)) continue;
    if (!Number.isFinite(amt) || amt < 0) continue;
    revenueByVariant.set(vid, (revenueByVariant.get(vid) ?? 0) + amt);
  }

  let anyRevenue = false;
  for (const vid of variantIds) {
    if ((revenueByVariant.get(vid) ?? 0) > 0) {
      anyRevenue = true;
      break;
    }
  }

  const byVariant: Record<string, ExperimentVariantPickMetrics> = {};
  type BestRow = {
    vid: string;
    rate: number;
    rpi: number;
    impressions: number;
    conversions: number;
    revenueTotal: number;
  };
  let best: BestRow | null = null;

  for (const vid of variantIds) {
    const s = stats.get(vid)!;
    const revenueTotal = revenueByVariant.get(vid) ?? 0;
    const rate = s.impressions > 0 ? s.conversions / s.impressions : 0;
    const revenuePerImpression = s.impressions > 0 ? revenueTotal / s.impressions : 0;
    byVariant[vid] = {
      impressions: s.impressions,
      conversions: s.conversions,
      rate,
      revenueTotal,
      revenuePerImpression,
    };
    if (s.impressions < EXPERIMENT_MIN_IMPRESSIONS_FOR_WINNER) continue;

    const row: BestRow = {
      vid,
      rate,
      rpi: revenuePerImpression,
      impressions: s.impressions,
      conversions: s.conversions,
      revenueTotal,
    };

    if (!best) {
      best = row;
      continue;
    }

    if (anyRevenue) {
      if (
        row.rpi > best.rpi ||
        (row.rpi === best.rpi && row.revenueTotal > best.revenueTotal) ||
        (row.rpi === best.rpi && row.revenueTotal === best.revenueTotal && row.conversions > best.conversions) ||
        (row.rpi === best.rpi &&
          row.revenueTotal === best.revenueTotal &&
          row.conversions === best.conversions &&
          row.impressions > best.impressions)
      ) {
        best = row;
      }
    } else {
      if (
        row.rate > best.rate ||
        (row.rate === best.rate && row.conversions > best.conversions) ||
        (row.rate === best.rate && row.conversions === best.conversions && row.impressions > best.impressions)
      ) {
        best = row;
      }
    }
  }

  if (!best) {
    const maxImpressions = Math.max(
      0,
      ...variantIds.map((vid) => byVariant[vid]?.impressions ?? 0),
    );
    const detail = {
      experimentId: eid,
      byVariant,
      minImpressions: EXPERIMENT_MIN_IMPRESSIONS_FOR_WINNER,
      maxImpressionsAcrossVariants: maxImpressions,
    };
    opsLog("experiment.pick_winner.threshold_not_met", detail);
    opsLog("experiment.pick_winner.low_sample", { experimentId: eid, code: "LOW_SAMPLE", ...detail });
    return {
      ok: false,
      experimentId: eid,
      reason: `LOW_SAMPLE | Terskel ikke nådd: minst ${EXPERIMENT_MIN_IMPRESSIONS_FOR_WINNER} visninger/impressions per variant.`,
    };
  }

  opsLog("experiment.pick_winner.selected", {
    experimentId: eid,
    winnerVariantId: best.vid,
    rate: best.rate,
    rpi: best.rpi,
    revenueTotal: best.revenueTotal,
    impressions: best.impressions,
    conversions: best.conversions,
    byVariant,
    minImpressions: EXPERIMENT_MIN_IMPRESSIONS_FOR_WINNER,
    scoringMode: anyRevenue ? "revenue_per_impression" : "conversion_rate",
  });

  return {
    ok: true,
    experimentId: eid,
    winnerVariantId: best.vid,
    byVariant,
    reason: anyRevenue
      ? `Høyeste omsetning per visning blant varianter med n≥${EXPERIMENT_MIN_IMPRESSIONS_FOR_WINNER} visninger.`
      : `Høyeste konverteringsrate blant varianter med n≥${EXPERIMENT_MIN_IMPRESSIONS_FOR_WINNER} visninger.`,
  };
}

/** Stable anonymous subject key from request headers (server-only). */
export function experimentSubjectKeyFromHeaders(ip: string, userAgent: string): string {
  const h = createHash("sha256").update(`${ip}|${userAgent}`, "utf8").digest("hex").slice(0, 24);
  return `anon_${h}`;
}
