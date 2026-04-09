import type { CapitalAllocationRow } from "@/lib/ai/capital/allocationEngine";
import type { BudgetPlanAction } from "@/lib/ai/capital/actionGenerator";
import { generateActions } from "@/lib/ai/capital/actionGenerator";
import type { CapitalState } from "@/lib/ai/capital/capitalState";
import type { InvestmentArea } from "@/lib/ai/capital/investmentAreas";

export type ExecutionPlanWithActions = {
  area: InvestmentArea;
  allocation: number;
  actions: BudgetPlanAction[];
};

export function buildExecution(allocation: CapitalAllocationRow[], state: CapitalState): ExecutionPlanWithActions[] {
  return allocation.map((item) => ({
    area: item.area,
    allocation: item.allocation,
    actions: generateActions(item.area, state),
  }));
}
