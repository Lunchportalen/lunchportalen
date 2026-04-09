/**
 * Audit row: resource-matched, capacity-safe schedule before budget action execution.
 */

import "server-only";

import type { BudgetPlanAction } from "@/lib/ai/capital/actionGenerator";
import type { ResourceExecutionPlan } from "@/lib/ai/resources/resourceOrchestrator";
import { insertAiMemory } from "@/lib/ai/memory/aiMemory";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RecordResourceAllocationOpts = {
  rid: string;
  requestedActions: BudgetPlanAction[];
  plan: ResourceExecutionPlan;
  utilization: number;
};

export async function recordResourceAllocation(
  opts: RecordResourceAllocationOpts,
): Promise<{ ok: boolean; message?: string }> {
  try {
    await insertAiMemory(supabaseAdmin(), {
      kind: "resource_allocation",
      source_rid: opts.rid,
      payload: {
        plan: opts.plan,
        utilization: opts.utilization,
        requestedActions: opts.requestedActions,
      },
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    opsLog("record_resource_allocation_failed", { rid: opts.rid, message });
    return { ok: false, message };
  }
}
