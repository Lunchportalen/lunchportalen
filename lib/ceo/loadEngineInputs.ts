import "server-only";

import { fetchLeadPipelineRows, fetchSocialPostsAndEvents } from "@/lib/db/growthAdminRead";
import type { AnalyzeBusinessInput } from "@/lib/ceo/engine";
import { normalizeLeadPipelineRow, type PipelineDealCard } from "@/lib/pipeline/dealNormalize";
import { enrichPipelineDeal, type EnrichedPipelineDeal } from "@/lib/pipeline/enrichDeal";
import { computePipelineMetrics } from "@/lib/revenue/pipelineMetrics";
import { calculatePipelineClosedRevenue } from "@/lib/revenue/leadPipelineAttribution";
import { forecastRevenue } from "@/lib/revenue/forecast";
import { mapSocialPostsFromDb } from "@/lib/social/analyticsAggregate";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE_TAG = "ceo_engine_inputs";

export type LoadCeoEngineInputsOptions = {
  /** Markedisolasjon: filtrer rader før normalisering (kolonne `market_id` og/eller `meta`). */
  filterPipelineRows?: (rows: Record<string, unknown>[]) => Record<string, unknown>[];
};

/**
 * Samme datagrunnlag som `/api/revenue/brain` og `/api/social/ai` (direkte lesing, ingen intern HTTP).
 */
export async function loadCeoEngineInputs(options?: LoadCeoEngineInputsOptions): Promise<AnalyzeBusinessInput> {
  const empty: AnalyzeBusinessInput = {
    pipeline: { deals: 0, totalValue: 0, weightedValue: 0, dealsList: [] },
    social: { posts: [] },
    revenue: { revenue: 0, forecast: 0 },
    flags: { socialLoaded: false },
  };

  if (!hasSupabaseAdminConfig()) {
    return empty;
  }

  const admin = supabaseAdmin();

  try {
    const { rows, leadPipelineAvailable } = await fetchLeadPipelineRows(admin, ROUTE_TAG);
    const rowsScoped = options?.filterPipelineRows ? options.filterPipelineRows(rows) : rows;
    const metrics = computePipelineMetrics(rowsScoped);

    const dealsList: EnrichedPipelineDeal[] = rowsScoped
      .map((r) => normalizeLeadPipelineRow(r))
      .filter((d): d is PipelineDealCard => d != null)
      .map((d) => enrichPipelineDeal(d));

    const revenue = calculatePipelineClosedRevenue(rowsScoped);
    const forecast = forecastRevenue(rowsScoped);

    let posts: unknown[] = [];
    let socialLoaded = false;

    const bundle = await fetchSocialPostsAndEvents(admin, ROUTE_TAG);
    if (bundle.ok === true) {
      socialLoaded = true;
      posts = mapSocialPostsFromDb(bundle.posts);
    }

    return {
      pipeline: {
        deals: leadPipelineAvailable ? rowsScoped.length : 0,
        totalValue: metrics.totalValue,
        weightedValue: metrics.weightedValue,
        dealsList: leadPipelineAvailable ? dealsList : [],
      },
      social: { posts },
      revenue: {
        revenue,
        forecast,
      },
      flags: { socialLoaded },
    };
  } catch {
    return empty;
  }
}
