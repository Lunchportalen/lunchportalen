import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";

export type RevenueAttributionSummary = {
  experimentRevenue7d: number;
  experimentRevenuePrior7d: number;
  topPagesByCta: Array<{ pageId: string; ctaClicks: number; pageViews: number; conversionProxy: number }>;
  explain: string[];
};

function isoSinceDays(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString();
}

/**
 * Read-only attribution hints — which surfaces correlate with revenue / conversion proxies.
 */
export async function summarizeRevenueAttribution(rid: string): Promise<RevenueAttributionSummary> {
  const sb = supabaseAdmin();
  const explain: string[] = [];
  const empty: RevenueAttributionSummary = {
    experimentRevenue7d: 0,
    experimentRevenuePrior7d: 0,
    topPagesByCta: [],
    explain: ["ingen_data"],
  };

  try {
    const since7 = isoSinceDays(7);
    const since14 = isoSinceDays(14);

    const { data: revRows, error: revErr } = await sb
      .from("experiment_revenue")
      .select("revenue,created_at")
      .gte("created_at", since14)
      .limit(20_000);

    if (revErr) {
      explain.push(`experiment_revenue_error:${revErr.message}`);
    } else {
      const t7 = Date.parse(since7);
      const t14 = Date.parse(since14);
      let r7 = 0;
      let p7 = 0;
      for (const row of revRows ?? []) {
        const r = row as { revenue?: unknown; created_at?: string };
        const t = r.created_at ? Date.parse(r.created_at) : NaN;
        const amt = Number(r.revenue ?? 0);
        if (!Number.isFinite(amt) || amt < 0 || !Number.isFinite(t)) continue;
        if (t >= t7) r7 += amt;
        else if (t >= t14 && t < t7) p7 += amt;
      }
      empty.experimentRevenue7d = r7;
      empty.experimentRevenuePrior7d = p7;
    }

    const { data: evRows, error: evErr } = await sb
      .from("content_analytics_events")
      .select("page_id,event_type")
      .eq("environment", "prod")
      .gte("created_at", since7)
      .not("page_id", "is", null)
      .limit(15_000);

    if (evErr) {
      explain.push(`analytics_error:${evErr.message}`);
      return { ...empty, explain };
    }

    const byPage = new Map<string, { pv: number; cta: number }>();
    for (const row of evRows ?? []) {
      const r = row as { page_id?: string | null; event_type?: string };
      const pid = r.page_id ? String(r.page_id) : "";
      if (!pid) continue;
      const cur = byPage.get(pid) ?? { pv: 0, cta: 0 };
      const et = String(r.event_type ?? "");
      if (et === "page_view") cur.pv += 1;
      if (et === "cta_click") cur.cta += 1;
      byPage.set(pid, cur);
    }

    const topPagesByCta = [...byPage.entries()]
      .map(([pageId, v]) => ({
        pageId,
        ctaClicks: v.cta,
        pageViews: v.pv,
        conversionProxy: v.pv > 0 ? v.cta / v.pv : 0,
      }))
      .filter((x) => x.ctaClicks > 0)
      .sort((a, b) => b.conversionProxy - a.conversionProxy)
      .slice(0, 12);

    explain.push(`pages_scanned=${byPage.size}`);

    return {
      experimentRevenue7d: empty.experimentRevenue7d,
      experimentRevenuePrior7d: empty.experimentRevenuePrior7d,
      topPagesByCta,
      explain,
    };
  } catch (e) {
    opsLog("revenue.attribution.failed", { rid, message: e instanceof Error ? e.message : String(e) });
    return { ...empty, explain: [...empty.explain, "exception"] };
  }
}
