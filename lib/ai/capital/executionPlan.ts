import type { CapitalAllocationRow } from "@/lib/ai/capital/allocationEngine";
import type { BudgetPlanAction } from "@/lib/ai/capital/actionGenerator";
import type { InvestmentArea } from "@/lib/ai/capital/investmentAreas";

export type CapitalExecutionPlanRow = {
  area: InvestmentArea;
  budgetPercent: number;
  actions: BudgetPlanAction[];
};

export function buildExecutionPlan(allocation: CapitalAllocationRow[]): CapitalExecutionPlanRow[] {
  return allocation.map((item) => ({
    area: item.area,
    budgetPercent: item.allocation,
    actions: [] as BudgetPlanAction[],
  }));
}
