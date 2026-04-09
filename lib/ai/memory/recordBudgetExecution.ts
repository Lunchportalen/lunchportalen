/**
 * Audit row for budget execution cron: allocation, prioritized plan, execution results (no payments).
 */

import "server-only";

import type { BudgetExecutionRow } from "@/lib/ai/automationEngine";
import type { CapitalAllocationRow } from "@/lib/ai/capital/allocationEngine";
import type { BudgetPlanAction } from "@/lib/ai/capital/actionGenerator";
import type { ExecutionPlanWithActions } from "@/lib/ai/capital/executionEngine";
import { insertAiMemory } from "@/lib/ai/memory/aiMemory";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RecordBudgetExecutionOpts = {
  rid: string;
  allocation: CapitalAllocationRow[];
  prioritizedPlan: ExecutionPlanWithActions[];
  flatActions: BudgetPlanAction[];
  executed: BudgetExecutionRow[];
};

export async function recordBudgetExecution(opts: RecordBudgetExecutionOpts): Promise<{ ok: boolean; message?: string }> {
  try {
    await insertAiMemory(supabaseAdmin(), {
      kind: "budget_execution",
      source_rid: opts.rid,
      payload: {
        allocation: opts.allocation,
        actions: opts.prioritizedPlan,
        flatActions: opts.flatActions,
        executed: opts.executed,
      },
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    opsLog("record_budget_execution_failed", { rid: opts.rid, message });
    return { ok: false, message };
  }
}
