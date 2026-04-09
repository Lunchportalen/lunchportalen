import type { ExecutionPlanWithActions } from "@/lib/ai/capital/executionEngine";

const MAX_ACTIONS_PER_AREA = 2;

/**
 * Caps generated actions per investment area (defense in depth before global run cap).
 */
export function prioritizeExecution(plan: ExecutionPlanWithActions[]): ExecutionPlanWithActions[] {
  return plan.map((p) => ({
    ...p,
    actions: p.actions.slice(0, MAX_ACTIONS_PER_AREA),
  }));
}
