import type { OrgAction } from "@/lib/ai/org/orgCoordinator";
import type { OrgContext } from "@/lib/ai/org/orgContext";

export function runProduct(ctx: OrgContext): OrgAction[] {
  const actions: OrgAction[] = [];
  if (ctx.conversion < 0.02) {
    actions.push({ type: "optimize" });
  }
  return actions;
}
