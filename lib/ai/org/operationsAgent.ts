import type { OrgAction } from "@/lib/ai/org/orgCoordinator";
import type { OrgContext } from "@/lib/ai/org/orgContext";

export function runOperations(ctx: OrgContext): OrgAction[] {
  const actions: OrgAction[] = [];
  if (ctx.churn > 0.05) {
    actions.push({ type: "stability_check" });
  }
  return actions;
}
