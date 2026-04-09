import type { BudgetPlanAction } from "@/lib/ai/capital/actionGenerator";
import { allocateCapacity } from "@/lib/ai/resources/capacityEngine";
import { getAvailableResources, totalResourceCapacity } from "@/lib/ai/resources/resourceModel";
import { scheduleActions, type ScheduledAllocationRow } from "@/lib/ai/resources/scheduler";

export type ResourceExecutionPlan = ScheduledAllocationRow[];

/**
 * WHO (resource) + HOW MUCH (cost) + WHEN (staggered ISO) — planning only before safe execution.
 */
export function buildExecutionPlan(actions: BudgetPlanAction[], nowMs?: number): ResourceExecutionPlan {
  const resources = getAvailableResources();
  const allocated = allocateCapacity(actions, resources);
  return scheduleActions(allocated, nowMs);
}

export function computeResourceUtilization(
  plan: ResourceExecutionPlan,
  resources = getAvailableResources(),
): number {
  const totalCap = totalResourceCapacity(resources);
  if (totalCap <= 0) return 0;
  const used = plan.reduce((s, p) => s + p.cost, 0);
  return Math.round((used / totalCap) * 1e6) / 1e6;
}
