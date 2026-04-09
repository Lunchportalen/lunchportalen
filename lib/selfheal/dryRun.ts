import type { RemediationPlanItem } from "./playbook";

export type SimulatedAction = RemediationPlanItem & { status: "would_execute" };

export function simulate(actions: RemediationPlanItem[]): SimulatedAction[] {
  return actions.map((a) => ({
    ...a,
    status: "would_execute",
  }));
}
