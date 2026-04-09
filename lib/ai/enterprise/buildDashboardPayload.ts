import "server-only";

import { makeRid } from "@/lib/http/respond";
import { calculateProfitFromMetrics } from "@/lib/ai/profit/engine";
import { suggestPricingAdjustments } from "@/lib/ai/pricing/engine";
import { segmentCustomers } from "@/lib/ai/segmentation/engine";
import { summarizeRevenueAttribution } from "@/lib/ai/revenue/attribution";
import { optimizeConversion } from "@/lib/ai/conversion/engine";
import { detectChurnRisk } from "@/lib/ai/retention/engine";
import { suggestRevenueAwareExperiments } from "@/lib/ai/experiments/revenueExperimentHints";
import { getBusinessMetrics } from "@/lib/ai/businessMetrics";
import { insertEnterpriseLog } from "@/lib/ai/enterprise/enterpriseLog";
import { loadSnapshot } from "@/lib/ai/ceo/decisionEngine";

export type EnterpriseDashboardPayload = {
  rid: string;
  profit: Awaited<ReturnType<typeof calculateProfitFromMetrics>>;
  pricing: ReturnType<typeof suggestPricingAdjustments>;
  segments: Awaited<ReturnType<typeof segmentCustomers>>;
  attribution: Awaited<ReturnType<typeof summarizeRevenueAttribution>>;
  conversion: ReturnType<typeof optimizeConversion>;
  retention: ReturnType<typeof detectChurnRisk>;
  experimentHints: ReturnType<typeof suggestRevenueAwareExperiments>;
  metrics: Awaited<ReturnType<typeof getBusinessMetrics>>;
};

export async function buildEnterpriseDashboardPayload(opts?: {
  rid?: string;
  /** When true, append one audit row (superadmin views). */
  persistLog?: boolean;
  actor_user_id?: string | null;
}): Promise<EnterpriseDashboardPayload> {
  const rid = opts?.rid ?? makeRid("enterprise_dash");
  const metrics = await getBusinessMetrics();
  const ceoSnap = await loadSnapshot(rid);
  const profit = await calculateProfitFromMetrics(rid);
  const pricing = suggestPricingAdjustments({
    usageLevel: Math.min(1, metrics.eventRowsSampled / 5000),
    conversionRate: metrics.conversionRate,
    churnRate: metrics.churnRate,
    competitorBenchmarkDelta: null,
  });
  const segments = await segmentCustomers(rid);
  const attribution = await summarizeRevenueAttribution(rid);
  const conversion = optimizeConversion({
    pageViews24h: ceoSnap.pageViews24h,
    ctaClicks24h: ceoSnap.ctaClicks24h,
    draftPages: ceoSnap.draftPages,
    runningExperiments: ceoSnap.runningExperiments,
  });
  const inactiveCompanies = segments.filter((s) => s.segment === "low_engagement").map((s) => s.companyId);
  const retention = detectChurnRisk({
    churnRate: metrics.churnRate,
    revenueGrowth: metrics.revenueGrowth,
    conversionRate: metrics.conversionRate,
    inactiveCompanyIds: inactiveCompanies,
  });
  const experimentHints = suggestRevenueAwareExperiments({
    runningExperiments: metrics.runningExperimentsCount,
    revenueGrowth: metrics.revenueGrowth,
    conversionRate: metrics.conversionRate,
    experimentRevenue7d: attribution.experimentRevenue7d,
  });

  if (opts?.persistLog) {
    await insertEnterpriseLog({
      rid,
      entry_type: "enterprise_dashboard_snapshot",
      actor_user_id: opts.actor_user_id ?? null,
      payload: {
        profitMargin: profit.margin,
        segmentCount: segments.length,
        pricingSuggestions: pricing.length,
        churnNotify: retention.filter((r) => r.notifyAdmin).length,
      },
    });
  }

  return {
    rid,
    profit,
    pricing,
    segments,
    attribution,
    conversion,
    retention,
    experimentHints,
    metrics,
  };
}
