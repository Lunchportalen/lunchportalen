/**
 * Audit row for the reality (perception alignment) cron — transparent planning only; execution is draft/optimize/experiment.
 */

import "server-only";

import type { OrgExecutionRow } from "@/lib/ai/automationEngine";
import type { PerceptionState } from "@/lib/ai/reality/perceptionEngine";
import type { OrgAction } from "@/lib/ai/org/orgCoordinator";
import { insertAiMemory } from "@/lib/ai/memory/aiMemory";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RecordRealityCycleOpts = {
  rid: string;
  perceptionState: PerceptionState;
  strategy: string[];
  actions: OrgAction[];
  executed: OrgExecutionRow[];
};

export async function recordRealityCycle(opts: RecordRealityCycleOpts): Promise<{ ok: boolean; message?: string }> {
  try {
    await insertAiMemory(supabaseAdmin(), {
      kind: "reality_cycle",
      source_rid: opts.rid,
      payload: {
        perception_state: opts.perceptionState,
        strategy: opts.strategy,
        actions: opts.actions,
        results: opts.executed,
      },
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    opsLog("record_reality_cycle_failed", { rid: opts.rid, message });
    return { ok: false, message };
  }
}
