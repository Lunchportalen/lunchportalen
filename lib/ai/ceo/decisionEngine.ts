import "server-only";

import type { CeoDecision, SystemSignalsSnapshot } from "@/lib/ai/ceo/types";
import { getSystemIntelligence } from "@/lib/ai/intelligence";
import { calculateProfitFromMetrics } from "@/lib/ai/profit/engine";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";

const MIN_DECISION_CONFIDENCE = 0.6;
const MAX_DECISIONS = 3;

function isoSinceHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

/** Exported for enterprise dashboard (base content analytics 24h, without profit merge). */
export async function loadSnapshot(rid: string): Promise<SystemSignalsSnapshot> {
  const empty: SystemSignalsSnapshot = {
    analyticsEvents24h: 0,
    pageViews24h: 0,
    ctaClicks24h: 0,
    runningExperiments: 0,
    draftPages: 0,
  };
  const since = isoSinceHoursAgo(24);
  const sb = supabaseAdmin();

  try {
    const { count: evCount } = await sb
      .from("content_analytics_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    const { count: pvCount } = await sb
      .from("content_analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "page_view")
      .gte("created_at", since);
    const { count: ctaCount } = await sb
      .from("content_analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "cta_click")
      .gte("created_at", since);
    const { count: expCount } = await sb
      .from("experiments")
      .select("id", { count: "exact", head: true })
      .eq("status", "running");
    const { count: draftCount } = await sb
      .from("content_pages")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft");

    return {
      analyticsEvents24h: evCount ?? 0,
      pageViews24h: pvCount ?? 0,
      ctaClicks24h: ctaCount ?? 0,
      runningExperiments: expCount ?? 0,
      draftPages: draftCount ?? 0,
    };
  } catch (e) {
    opsLog("ai_ceo.snapshot_failed", { rid, message: e instanceof Error ? e.message : String(e) });
    return empty;
  }
}

function priorityRank(p: CeoDecision["priority"]): number {
  if (p === "high") return 0;
  if (p === "medium") return 1;
  return 2;
}

/**
 * Deterministic, explainable recommendations from DB signals (no LLM).
 */
export async function evaluateSystem(opts: { rid: string }): Promise<{ decisions: CeoDecision[]; snapshot: SystemSignalsSnapshot }> {
  const base = await loadSnapshot(opts.rid);
  const profit = await calculateProfitFromMetrics(opts.rid);
  const profitSignal =
    profit.margin > 0.28 ? "strong" : profit.margin > 0.12 ? "neutral" : ("weak" as const);

  let unifiedIntelligence: SystemSignalsSnapshot["unifiedIntelligence"];
  try {
    const intel = await getSystemIntelligence({ limit: 800 });
    unifiedIntelligence = {
      signals: intel.signals,
      trends: intel.trends,
      eventCounts: intel.meta?.eventCounts ?? {},
      topPatterns: (intel.meta?.topPatterns ?? []).slice(0, 8),
    };
  } catch (e) {
    opsLog("ai_ceo.unified_intelligence_failed", {
      rid: opts.rid,
      message: e instanceof Error ? e.message : String(e),
    });
    unifiedIntelligence = undefined;
  }

  const snap: SystemSignalsSnapshot = {
    ...base,
    profitMargin: profit.margin,
    profitPerCustomerProxy: profit.profitPerCustomer,
    profitSignal,
    profitExplain: profit.explain.slice(0, 8),
    unifiedIntelligence,
  };

  const decisions: CeoDecision[] = [];

  if (profitSignal === "weak") {
    decisions.push({
      type: "experiment",
      priority: "high",
      confidence: 0.67,
      reason: `Margin/proxy er svak (${(profit.margin * 100).toFixed(1)} %). Prioriter kontrollert eksperiment eller CRO som kan dokumentere inntektseffekt — kun med manuell godkjenning.`,
      expectedImpact: 0.22,
    });
  }

  if (snap.draftPages > 0 && snap.analyticsEvents24h < 120) {
    decisions.push({
      type: "content_improve",
      priority: "high",
      confidence: 0.72,
      reason:
        `Det finnes ${snap.draftPages} kladdside(r) og lav analytics-aktivitet siste 24t (${snap.analyticsEvents24h} hendelser). Prioriter å ferdigstille eller publisere målrettet innhold.`,
      expectedImpact: 0.18,
    });
  }

  if (snap.runningExperiments === 0 && snap.pageViews24h > 180) {
    decisions.push({
      type: "experiment",
      priority: "medium",
      confidence: 0.68,
      reason: `Ingen kjørende eksperimenter mens sidevisninger siste 24t er ${snap.pageViews24h}. Vurder kontrollert A/B på forsiden eller hoved-CTA.`,
      expectedImpact: 0.12,
    });
  }

  const ctr = snap.pageViews24h > 0 ? snap.ctaClicks24h / snap.pageViews24h : 0;
  if (snap.pageViews24h > 80 && ctr < 0.02) {
    decisions.push({
      type: "seo_fix",
      priority: "low",
      confidence: 0.64,
      reason: `Lav CTA-rate (${(ctr * 100).toFixed(2)} %) mot ${snap.pageViews24h} sidevisninger. Vurder SEO/ CRO på topp-sider.`,
      expectedImpact: 0.09,
    });
  }

  if (snap.draftPages > 2) {
    decisions.push({
      type: "publish",
      priority: "medium",
      confidence: 0.61,
      reason: `Flere kladder (${snap.draftPages}). Vurder arbeidsflyt/godkjenning før produksjonspublisering — kun manuelt.`,
      expectedImpact: 0.11,
    });
  }

  const filtered = decisions.filter((d) => d.confidence >= MIN_DECISION_CONFIDENCE);
  filtered.sort((a, b) => {
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    return b.confidence - a.confidence;
  });

  return { decisions: filtered.slice(0, MAX_DECISIONS), snapshot: snap };
}
