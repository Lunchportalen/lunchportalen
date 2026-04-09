/**
 * Audit row for the org cron (context → agents → merge → execute ≤2).
 */

import "server-only";

import type { OrgExecutionRow } from "@/lib/ai/automationEngine";
import type { CeoDirective } from "@/lib/ai/org/ceoAgent";
import type { OrgAction } from "@/lib/ai/org/orgCoordinator";
import type { OrgContext } from "@/lib/ai/org/orgContext";
import { insertAiMemory } from "@/lib/ai/memory/aiMemory";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RecordOrgCycleOpts = {
  rid: string;
  context: OrgContext;
  ceoDirectives: CeoDirective[];
  growthActions: OrgAction[];
  productActions: OrgAction[];
  operationsActions: OrgAction[];
  mergedActions: OrgAction[];
  executed: OrgExecutionRow[];
};

export async function recordOrgCycle(opts: RecordOrgCycleOpts): Promise<{ ok: boolean; message?: string }> {
  try {
    await insertAiMemory(supabaseAdmin(), {
      kind: "org_cycle",
      source_rid: opts.rid,
      payload: {
        context: opts.context,
        ceoDirectives: opts.ceoDirectives,
        agentOutputs: {
          growth: opts.growthActions,
          product: opts.productActions,
          operations: opts.operationsActions,
        },
        mergedActions: opts.mergedActions,
        executed: opts.executed,
      },
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    opsLog("record_org_cycle_failed", { rid: opts.rid, message });
    return { ok: false, message };
  }
}
