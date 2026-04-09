import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";

export type PageEnterpriseInsights = {
  pageId: string;
  pageViews7d: number;
  ctaClicks7d: number;
  conversionScore: number;
  revenueImpactProxy: number;
  suggestions: string[];
  explain: string[];
};

function isoSinceDays(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString();
}

/**
 * Per-page signals for CMS (prod analytics only) — proxies, not accounting truth.
 */
export async function getPageEnterpriseInsights(pageId: string, rid: string): Promise<PageEnterpriseInsights | null> {
  const pid = String(pageId ?? "").trim();
  if (!pid) return null;

  const sb = supabaseAdmin();
  try {
    const since = isoSinceDays(7);
    const { data, error } = await sb
      .from("content_analytics_events")
      .select("event_type")
      .eq("environment", "prod")
      .eq("page_id", pid)
      .gte("created_at", since)
      .limit(8000);

    if (error) {
      opsLog("enterprise.page_insights.error", { rid, message: error.message });
      return null;
    }

    let pv = 0;
    let cta = 0;
    for (const row of data ?? []) {
      const et = String((row as { event_type?: string }).event_type ?? "");
      if (et === "page_view") pv += 1;
      if (et === "cta_click") cta += 1;
    }

    const conversionScore = pv > 0 ? Math.min(1, (cta / pv) * 8) : 0;
    const revenueImpactProxy = Math.min(1, Math.log1p(pv) / 10 + conversionScore * 0.15);

    const suggestions: string[] = [];
    if (pv > 40 && cta / Math.max(pv, 1) < 0.02) {
      suggestions.push("Styrk primær CTA og verdiforslag over fold.");
    }
    if (pv < 15) {
      suggestions.push("Lav trafikk — vurder SEO distribusjon eller intern lenking.");
    }
    if (suggestions.length === 0) {
      suggestions.push("Fortsett måling; ingen kritisk avvik i proxy-data.");
    }

    return {
      pageId: pid,
      pageViews7d: pv,
      ctaClicks7d: cta,
      conversionScore,
      revenueImpactProxy,
      suggestions,
      explain: [`events=${(data ?? []).length}`, `window=7d_prod`],
    };
  } catch (e) {
    opsLog("enterprise.page_insights.failed", { rid, message: e instanceof Error ? e.message : String(e) });
    return null;
  }
}
