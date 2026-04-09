import "server-only";

import { buildCeoSnapshotData } from "@/lib/ceo/buildSnapshot";
import { fetchLeadPipelineRows } from "@/lib/db/growthAdminRead";
import type { EnrichedPipelineDeal } from "@/lib/pipeline/enrichDeal";
import { enrichPipelineDeal } from "@/lib/pipeline/enrichDeal";
import { normalizeLeadPipelineRow, type PipelineDealCard } from "@/lib/pipeline/dealNormalize";
import { loadGrowthOptimizationUi } from "@/lib/growth/loadGrowthOptimization";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

export type SalesCockpitServerPayload = {
  ceo: Awaited<ReturnType<typeof buildCeoSnapshotData>>;
  deals: EnrichedPipelineDeal[];
  pipelineAvailable: boolean;
  growthOptimization: Awaited<ReturnType<typeof loadGrowthOptimizationUi>>;
};

/**
 * Én server-side laster for Sales Cockpit — samme kilder som CEO-snapshot + berikede pipeline-rader.
 * (CEO bygger allerede pipeline-innsikt; rader hentes separat for kanban uten å endre CEO-kontrakt.)
 */
export async function loadSalesCockpitServerData(): Promise<SalesCockpitServerPayload> {
  if (!hasSupabaseAdminConfig()) {
    return {
      ceo: { ok: false, error: "Supabase admin er ikke konfigurert.", code: "CONFIG_ERROR" },
      deals: [],
      pipelineAvailable: false,
      growthOptimization: await loadGrowthOptimizationUi(),
    };
  }

  const admin = supabaseAdmin();

  const [ceo, pipelineResult, growthOptimization] = await Promise.all([
    buildCeoSnapshotData(),
    fetchLeadPipelineRows(admin, "sales_cockpit"),
    loadGrowthOptimizationUi(),
  ]);

  const { rows, leadPipelineAvailable } = pipelineResult;
  const deals = rows
    .map((r) => normalizeLeadPipelineRow(r))
    .filter((d): d is PipelineDealCard => d != null)
    .map((d) => enrichPipelineDeal(d));

  return {
    ceo,
    deals,
    pipelineAvailable: leadPipelineAvailable,
    growthOptimization,
  };
}

