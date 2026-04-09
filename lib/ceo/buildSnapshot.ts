import "server-only";

import { calculatePipelineClosedRevenue } from "@/lib/revenue/leadPipelineAttribution";
import { getPipelineRevenueActions } from "@/lib/revenue/leadPipelineDecisions";
import { scorePipelineLeads } from "@/lib/revenue/leadPipelineScoring";
import { type LeadForClosing, generateClosingMessage } from "@/lib/revenue/closing";
import { forecastRevenue } from "@/lib/revenue/forecast";
import { prioritizeLeads } from "@/lib/revenue/prioritization";
import { getDailyPlaybook } from "@/lib/revenue/playbook";
import { getNextActions } from "@/lib/social/actionEngine";
import {
  attachSourceTextToAnalytics,
  generateFromTopPosts,
} from "@/lib/social/aiGenerator";
import {
  aggregateSocialAnalytics,
  mapSocialEventsFromDb,
  mapSocialPostsFromDb,
} from "@/lib/social/analyticsAggregate";
import { extractPatterns } from "@/lib/social/patterns";
import { getRecommendations } from "@/lib/social/recommendations";
import { countSocialLeadEvents, fetchLeadPipelineRows, fetchSocialPostsAndEvents } from "@/lib/db/growthAdminRead";
import { computePipelineInsights, enrichPipelineDeal } from "@/lib/pipeline/enrichDeal";
import { normalizeLeadPipelineRow, type PipelineDealCard } from "@/lib/pipeline/dealNormalize";
import { computePipelineMetrics } from "@/lib/revenue/pipelineMetrics";
import type { ProfitOptimizationResult } from "@/lib/growth/profitOptimizationPipeline";
import { runProfitOptimizationPipeline } from "@/lib/growth/profitOptimizationPipeline";
import { buildInvestorValuationResult } from "@/lib/finance/runInvestorValuation";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Samme datagrunnlag som `/api/revenue/brain`, `/api/social/ai`, `/api/revenue/autopilot`,
 * samlet uten intern HTTP (én pipeline-lesing + sosiale tabeller).
 */
export type CeoSnapshotPayload = {
  revenue: number;
  leads: number;
  forecast: number;
  actions: string[];
  revenueBrain: {
    revenue: number;
    leads: unknown[];
    actions: Array<{ type: string; message: string }>;
    socialLeadEventCount: number | null;
  };
  growthAi: {
    patterns: unknown;
    generated: unknown;
    actions: Array<{ type: string; message: string }>;
    recommendations: Array<{ type: string; message: string }>;
  };
  autopilot: {
    forecast: number;
    prioritized: ReturnType<typeof prioritizeLeads>;
    playbook: string[];
    closing: Array<{ id: string; message: string }>;
  };
  /** Tom data kan bety «ingen rader» eller «tabell ikke i DB» — brukes av superadmin. */
  dataAvailability: {
    leadPipeline: boolean;
    socialEvents: boolean;
    socialPosts: boolean;
    /** Hendelser er avledet fra `social_posts` (ingen `social_events`-tabell). */
    socialEventsBackedByPosts: boolean;
  };
  pipeline: {
    available: boolean;
    deals: number;
    totalValue: number;
    weightedValue: number;
  };
  pipelineInsights: {
    riskyDeals: number;
    strongDeals: number;
    avgWinProbability: number;
  };
  /** Kanal-ROI og budsjettforslag (kun anbefaling, ingen auto-spend). */
  profitOptimization: ProfitOptimizationResult | null;
  /** Indikativ ARR/multiple/vekst fra ordre + pipeline (samme motor som `/superadmin/investor`). */
  investorValuation: {
    arr: number;
    valuation: number;
    multiple: number;
    growthRate: number;
    weightedPipeline: number;
    lines: string[];
  } | null;
};

export async function buildCeoSnapshotData(): Promise<
  | { ok: true; snapshot: CeoSnapshotPayload }
  | { ok: false; error: string; code?: string }
> {
  if (!hasSupabaseAdminConfig()) {
    return { ok: false, error: "Supabase admin er ikke konfigurert.", code: "CONFIG_ERROR" };
  }

  const admin = supabaseAdmin();
  const routeTag = "buildCeoSnapshotData";

  const pipelineResult = await fetchLeadPipelineRows(admin, routeTag);
  const { rows: leadsRecords, leadPipelineAvailable } = pipelineResult;

  const pipelineMetrics = computePipelineMetrics(leadsRecords);
  console.log("[PIPELINE_METRICS]", {
    route: routeTag,
    available: leadPipelineAvailable,
    deals: leadsRecords.length,
    totalValue: pipelineMetrics.totalValue,
    weightedValue: pipelineMetrics.weightedValue,
    dealCount: pipelineMetrics.dealCount,
    avgDealSize: pipelineMetrics.avgDealSize,
  });

  const enrichedDeals = leadsRecords
    .map((r) => normalizeLeadPipelineRow(r))
    .filter((d): d is PipelineDealCard => d != null)
    .map((d) => enrichPipelineDeal(d));
  const pipelineInsights = computePipelineInsights(enrichedDeals);
  console.log("[PIPELINE_INSIGHTS]", { route: routeTag, ...pipelineInsights });

  const revenue = calculatePipelineClosedRevenue(leadsRecords);
  const scoredLeads = scorePipelineLeads(leadsRecords);
  const revActions = getPipelineRevenueActions(leadsRecords);

  const socialLeadEventCount = await countSocialLeadEvents(admin, routeTag);

  const socialBundle = await fetchSocialPostsAndEvents(admin, routeTag);
  if (socialBundle.ok === false) {
    return { ok: false, error: socialBundle.error, code: socialBundle.code };
  }

  const {
    posts,
    events,
    socialEventsAvailable,
    socialPostsAvailable,
    socialEventsSubstitutedFromPosts,
  } = socialBundle;
  const postRows = mapSocialPostsFromDb(posts);
  const eventRows = mapSocialEventsFromDb(events);
  const analytics = aggregateSocialAnalytics(postRows, eventRows);
  const recommendations = getRecommendations(analytics);
  const withText = attachSourceTextToAnalytics(analytics, postRows);
  const patterns = extractPatterns(analytics);
  const generated = generateFromTopPosts(withText);
  const growthActions = getNextActions(analytics);

  const prioritized = prioritizeLeads(leadsRecords);
  const forecast = forecastRevenue(leadsRecords);
  const playbook = getDailyPlaybook(leadsRecords);
  const closing = prioritized.slice(0, 3).map((l) => ({
    id: String(l.id ?? ""),
    message: generateClosingMessage(l as LeadForClosing),
  }));

  let profitOptimization: ProfitOptimizationResult | null = null;
  try {
    profitOptimization = await runProfitOptimizationPipeline({ logDecision: false, rid: `${routeTag}_profit` });
  } catch {
    profitOptimization = null;
  }

  let investorValuation: CeoSnapshotPayload["investorValuation"] = null;
  let investorLines: string[] = [];
  try {
    const inv = await buildInvestorValuationResult({ log: false, rid: `${routeTag}_investor` });
    investorValuation = {
      arr: inv.arr.arr,
      valuation: inv.valuation.valuation,
      multiple: inv.valuation.multiple,
      growthRate: inv.growthRate,
      weightedPipeline: inv.kpis.weightedPipeline,
      lines: [...inv.valuation.explain, ...inv.arr.explain.slice(0, 3)],
    };
    investorLines = investorValuation.lines.slice(0, 8);
  } catch {
    investorValuation = null;
    investorLines = [];
  }

  const profitFeed =
    profitOptimization && Object.keys(profitOptimization.roi).length > 0
      ? [
          profitOptimization.explain,
          ...profitOptimization.issues.slice(0, 3).map((i) => `Kanal ${i.channel}: ${i.problem}`),
        ]
      : [];

  const actionStrings: string[] = [
    ...revActions.map((a) => a.message),
    ...growthActions.map((a) => a.message),
    ...playbook,
    ...profitFeed,
    ...investorLines,
  ];

  const snapshot: CeoSnapshotPayload = {
    revenue,
    leads: scoredLeads.length,
    forecast,
    actions: actionStrings,
    revenueBrain: {
      revenue,
      leads: scoredLeads,
      actions: revActions,
      socialLeadEventCount,
    },
    growthAi: {
      patterns,
      generated,
      actions: growthActions,
      recommendations,
    },
    autopilot: {
      forecast,
      prioritized,
      playbook,
      closing,
    },
    dataAvailability: {
      leadPipeline: leadPipelineAvailable,
      socialEvents: socialEventsAvailable,
      socialPosts: socialPostsAvailable,
      socialEventsBackedByPosts: socialEventsSubstitutedFromPosts,
    },
    pipeline: {
      available: leadPipelineAvailable,
      deals: leadsRecords.length,
      totalValue: pipelineMetrics.totalValue,
      weightedValue: pipelineMetrics.weightedValue,
    },
    pipelineInsights,
    profitOptimization,
    investorValuation,
  };

  return { ok: true, snapshot };
}
