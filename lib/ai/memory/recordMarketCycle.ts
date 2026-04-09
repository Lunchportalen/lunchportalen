/**
 * Audit row for the market intelligence cron (context → insights → gaps → position → pricing sim → expansion → execute ≤2).
 */

import "server-only";

import type { OrgExecutionRow } from "@/lib/ai/automationEngine";
import type { PricingSimulationSuggestion } from "@/lib/ai/market/pricingStrategyEngine";
import type { MarketContext } from "@/lib/ai/market/marketContext";
import type { MarketPosition } from "@/lib/ai/market/positioningEngine";
import type { OrgAction } from "@/lib/ai/org/orgCoordinator";
import { insertAiMemory } from "@/lib/ai/memory/aiMemory";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RecordMarketCycleOpts = {
  rid: string;
  context: MarketContext;
  competitorInsights: string[];
  gaps: string[];
  position: MarketPosition;
  pricingSuggestions: PricingSimulationSuggestion[];
  expansion: string[];
  decidedActions: OrgAction[];
  executed: OrgExecutionRow[];
};

export async function recordMarketCycle(opts: RecordMarketCycleOpts): Promise<{ ok: boolean; message?: string }> {
  try {
    await insertAiMemory(supabaseAdmin(), {
      kind: "market_cycle",
      source_rid: opts.rid,
      payload: {
        context: opts.context,
        insights: opts.competitorInsights,
        gaps: opts.gaps,
        position: opts.position,
        pricingSuggestions: opts.pricingSuggestions,
        expansion: opts.expansion,
        decisions: opts.decidedActions,
        executed: opts.executed,
      },
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    opsLog("record_market_cycle_failed", { rid: opts.rid, message });
    return { ok: false, message };
  }
}
