/**
 * Persists omniscient / market-simulation runs to ai_memory. Simulation only — no pricing or prod writes.
 */

import "server-only";

import type { OmniscientDecisionAction } from "@/lib/ai/omniscientDecisionEngine";
import type { MarketSimulation } from "@/lib/ai/marketSimulationEngine";
import type { OmniscientState } from "@/lib/ai/omniscientContext";
import { insertAiMemory } from "@/lib/ai/memory/aiMemory";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RecordOmniscientCycleOpts = {
  rid: string;
  state: OmniscientState;
  simulations: MarketSimulation[];
  opportunities: MarketSimulation[];
  ranked: MarketSimulation[];
  expansion: string[];
  actions: OmniscientDecisionAction[];
  hints: string[];
};

export async function recordOmniscientCycle(opts: RecordOmniscientCycleOpts): Promise<{ ok: boolean; message?: string }> {
  try {
    await insertAiMemory(supabaseAdmin(), {
      kind: "omniscient_cycle",
      source_rid: opts.rid,
      payload: {
        state: opts.state,
        simulations: opts.simulations,
        opportunities: opts.opportunities,
        ranked: opts.ranked,
        expansion: opts.expansion,
        actions: opts.actions,
        hints: opts.hints,
      },
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    opsLog("record_omniscient_failed", { rid: opts.rid, message });
    return { ok: false, message };
  }
}
