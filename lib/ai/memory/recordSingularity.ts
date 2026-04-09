/**
 * Persists a full “god mode” / business-engine decision trace to ai_memory.
 * Pricing suggestions are stored for audit only — never executed here.
 */

import "server-only";

import type { BusinessState } from "@/lib/ai/businessStateEngine";
import type { GodModePricingSignal, PricingSuggestion } from "@/lib/ai/pricingEngine";
import type { SingularityExecuteResult } from "@/lib/ai/automationEngine";
import { insertAiMemory } from "@/lib/ai/memory/aiMemory";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RecordSingularityOpts = {
  rid: string;
  state: BusinessState;
  leaks: string[];
  pricing: Array<PricingSuggestion | GodModePricingSignal>;
  strategy: string[];
  executed: SingularityExecuteResult[];
};

export async function recordSingularity(opts: RecordSingularityOpts): Promise<{ ok: boolean; message?: string }> {
  try {
    await insertAiMemory(supabaseAdmin(), {
      kind: "god_mode_cycle",
      source_rid: opts.rid,
      payload: {
        state: opts.state,
        leaks: opts.leaks,
        pricing: opts.pricing,
        strategy: opts.strategy,
        executed: opts.executed,
      },
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    opsLog("record_singularity_failed", { rid: opts.rid, message });
    return { ok: false, message };
  }
}
