/**
 * Audit trail for autonomous revenue mode (simulations + offers + gaps + executed singularity steps).
 */

import "server-only";

import type { SingularityExecuteResult } from "@/lib/ai/automationEngine";
import type { OmniscientState } from "@/lib/ai/omniscientContext";
import type { AdvancedPricingSimulation } from "@/lib/ai/pricingSimulationEngine";
import type { RevenueOfferTag } from "@/lib/ai/offerEngine";
import type { MonetizationGapTag } from "@/lib/ai/monetizationGapEngine";
import type { RevenueInsights } from "@/lib/ai/revenueIntelligenceEngine";
import type { RevenueDecisionAction } from "@/lib/ai/revenueDecisionEngine";
import { insertAiMemory } from "@/lib/ai/memory/aiMemory";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RecordRevenueModeCycleOpts = {
  rid: string;
  state: OmniscientState;
  revenueInsights: RevenueInsights;
  simulations: AdvancedPricingSimulation[];
  offers: RevenueOfferTag[];
  gaps: MonetizationGapTag[];
  plannedActions: RevenueDecisionAction[];
  blockedActionTypes: string[];
  executed: SingularityExecuteResult[];
};

export async function recordRevenueModeCycle(
  opts: RecordRevenueModeCycleOpts,
): Promise<{ ok: boolean; message?: string }> {
  try {
    await insertAiMemory(supabaseAdmin(), {
      kind: "revenue_mode_cycle",
      source_rid: opts.rid,
      payload: {
        state: opts.state,
        revenueInsights: opts.revenueInsights,
        simulations: opts.simulations,
        offers: opts.offers,
        gaps: opts.gaps,
        plannedActions: opts.plannedActions,
        blockedActionTypes: opts.blockedActionTypes,
        executed: opts.executed,
      },
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    opsLog("record_revenue_mode_failed", { rid: opts.rid, message });
    return { ok: false, message };
  }
}
