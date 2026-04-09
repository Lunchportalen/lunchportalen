import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { allocateBudget } from "@/lib/growth/allocation";
import { getChannelPerformance } from "@/lib/growth/channelPerformance";
import { detectIssues, type ChannelIssue } from "@/lib/growth/diagnostics";
import { generateRecommendations, type BudgetRecommendation } from "@/lib/growth/recommendations";
import { computeROI, type RoiMap } from "@/lib/growth/roi";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "profit_optimization";

export type ProfitOptimizationResult = {
  roi: RoiMap;
  allocation: Record<string, number>;
  issues: ChannelIssue[];
  recommendations: BudgetRecommendation[];
  mode: "recommendation_only";
  explain: string;
};

function safeRoiForLog(roi: RoiMap): Record<string, { revenue: number; orders: number; posts: number; efficiency: number }> {
  const out: Record<string, { revenue: number; orders: number; posts: number; efficiency: number }> = {};
  for (const [k, v] of Object.entries(roi)) {
    out[k] = {
      revenue: v.revenue,
      orders: v.orders,
      posts: v.posts,
      efficiency: v.efficiency,
    };
  }
  return out;
}

async function logBudgetAllocation(opts: {
  rid: string;
  roi: RoiMap;
  allocation: Record<string, number>;
  issueCount: number;
  recommendationCount: number;
}): Promise<void> {
  try {
    if (!hasSupabaseAdminConfig()) return;
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return;
    const row = buildAiActivityLogRow({
      action: "budget_allocation",
      metadata: {
        allocation: opts.allocation,
        roi: safeRoiForLog(opts.roi),
        mode: "recommendation_only",
        issue_count: opts.issueCount,
        recommendation_count: opts.recommendationCount,
      },
    });
    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      rid: opts.rid,
      status: "success" as const,
    } as Record<string, unknown>);
    if (error) console.error("[profitOptimizationPipeline] log", error.message);
  } catch (e) {
    console.error("[profitOptimizationPipeline] log", e instanceof Error ? e.message : String(e));
  }
}

/**
 * Full pipeline: faktiske ordre + poster → ROI → forslag til fordeling.
 * `logDecision`: skriv én rad i `ai_activity_log` (etter migrering med `budget_allocation`).
 */
export async function runProfitOptimizationPipeline(opts: {
  totalBudget?: number;
  logDecision?: boolean;
  rid?: string;
}): Promise<ProfitOptimizationResult> {
  const channelData = await getChannelPerformance();
  const roi = computeROI(channelData);
  const allocation = allocateBudget(roi, opts.totalBudget ?? 100_000);
  const issues = detectIssues(roi);
  const recommendations = generateRecommendations(allocation, issues);

  if (opts.logDecision === true) {
    const rid = opts.rid ?? `profit_opt_${Date.now().toString(36)}`;
    await logBudgetAllocation({
      rid,
      roi,
      allocation,
      issueCount: issues.length,
      recommendationCount: recommendations.length,
    });
  }

  return {
    roi,
    allocation,
    issues,
    recommendations,
    mode: "recommendation_only",
    explain:
      "Alle tall er fra faktiske ordrer og SoMe-poster. Ingen automatisk annonsekjøp — kun anbefalinger til manuell godkjenning.",
  };
}
