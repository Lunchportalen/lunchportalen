import type { BudgetPlanAction } from "@/lib/ai/capital/actionGenerator";
import { estimateActionCost } from "@/lib/ai/resources/actionCost";
import { matchResource } from "@/lib/ai/resources/matchEngine";
import type { Resource } from "@/lib/ai/resources/resourceModel";

export type CapacityAllocationRow = {
  action: BudgetPlanAction;
  resourceId: string;
  cost: number;
};

/**
 * Assigns each action to a matched resource (fallback `ai_ops`) only if remaining capacity ≥ cost.
 * Never deducts below zero — skips action if insufficient capacity.
 */
export function allocateCapacity(actions: BudgetPlanAction[], resources: Resource[]): CapacityAllocationRow[] {
  const capacityMap: Record<string, number> = Object.fromEntries(
    resources.map((r) => [r.id, Math.max(0, r.capacity)] as const),
  );
  const allocations: CapacityAllocationRow[] = [];
  const opsFallback = resources.find((r) => r.id === "ai_ops") ?? null;

  for (const action of actions) {
    let resource = matchResource(action, resources);
    if (!resource && opsFallback) {
      resource = opsFallback;
    }
    if (!resource) continue;

    const cost = estimateActionCost(action);
    const available = capacityMap[resource.id] ?? 0;
    if (available < cost) {
      continue;
    }

    allocations.push({ action, resourceId: resource.id, cost });
    capacityMap[resource.id] = available - cost;
  }

  return allocations;
}
