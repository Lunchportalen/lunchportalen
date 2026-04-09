import "server-only";

import type { ExperimentResults, VariantResultRow } from "@/lib/experiments/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

const MIN_VIEWS_FOR_WINNER = 20;

/**
 * Aggregate experiment_events into per-variant metrics + optional winner (highest conversion rate).
 */
export async function calculateResults(
  experimentId: string,
): Promise<{ ok: true; results: ExperimentResults } | { ok: false; error: string }> {
  const id = String(experimentId ?? "").trim();
  if (!id) return { ok: false, error: "Missing experimentId" };

  const supabase = supabaseAdmin();

  try {
    const { data: variants, error: vErr } = await supabase
      .from("experiment_variants")
      .select("variant_id")
      .eq("experiment_id", id);

    if (vErr) return { ok: false, error: vErr.message };

    const counts = new Map<string, { views: number; clicks: number; conversions: number }>();
    for (const r of variants ?? []) {
      const vid = String((r as { variant_id: string }).variant_id ?? "");
      if (vid) counts.set(vid, { views: 0, clicks: 0, conversions: 0 });
    }

    const { data: rows, error } = await supabase
      .from("experiment_events")
      .select("variant_id, event_type")
      .eq("experiment_id", id);

    if (error) return { ok: false, error: error.message };

    for (const raw of rows ?? []) {
      const row = raw as { variant_id?: string; event_type?: string };
      const vid = String(row.variant_id ?? "");
      const et = String(row.event_type ?? "");
      if (!vid) continue;
      if (!counts.has(vid)) counts.set(vid, { views: 0, clicks: 0, conversions: 0 });
      const c = counts.get(vid)!;
      if (et === "view" || et === "impression") c.views += 1;
      else if (et === "click") c.clicks += 1;
      else if (et === "conversion") c.conversions += 1;
    }

    const variantsOut: VariantResultRow[] = [...counts.entries()].map(([variantId, c]) => ({
      variantId,
      views: c.views,
      clicks: c.clicks,
      conversions: c.conversions,
      conversionRate: c.views > 0 ? c.conversions / c.views : 0,
    }));

    variantsOut.sort((a, b) => b.conversionRate - a.conversionRate || b.views - a.views);

    const eligible = variantsOut.filter((v) => v.views >= MIN_VIEWS_FOR_WINNER);
    let winner: ExperimentResults["winner"] = null;
    if (eligible.length > 0) {
      const top = eligible[0]!;
      winner = {
        variantId: top.variantId,
        conversionRate: top.conversionRate,
        reason: `Highest conversion rate among variants with ≥${MIN_VIEWS_FOR_WINNER} views (production aggregate).`,
      };
    }

    return {
      ok: true,
      results: { variants: variantsOut, winner },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Evaluation failed";
    return { ok: false, error: msg };
  }
}
