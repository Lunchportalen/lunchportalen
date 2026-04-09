/**
 * Audit row for the autonomous SaaS cron (observe → analyze → generate → prioritize → execute → learn).
 */

import "server-only";

import type { SingularityExecuteResult } from "@/lib/ai/automationEngine";
import type { SaasIntelligence } from "@/lib/ai/saasIntelligenceEngine";
import type { SaasState } from "@/lib/ai/saasStateEngine";
import type { SingularityActionWithScore } from "@/lib/ai/prioritizationEngine";
import { insertAiMemory } from "@/lib/ai/memory/aiMemory";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RecordAutonomousCycleOpts = {
  rid: string;
  state: SaasState;
  intel: SaasIntelligence;
  opportunities: string[];
  prioritized: SingularityActionWithScore[];
  executed: SingularityExecuteResult[];
};

export async function recordAutonomousCycle(
  opts: RecordAutonomousCycleOpts,
): Promise<{ ok: boolean; message?: string }> {
  try {
    await insertAiMemory(supabaseAdmin(), {
      kind: "autonomous_cycle",
      source_rid: opts.rid,
      payload: {
        state: opts.state,
        intel: opts.intel,
        opportunities: opts.opportunities,
        prioritized: opts.prioritized.map((p) => ({ type: p.type, score: p.score })),
        executed: opts.executed,
      },
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    opsLog("record_autonomous_failed", { rid: opts.rid, message });
    return { ok: false, message };
  }
}
