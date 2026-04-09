import type { CeoDirective } from "@/lib/ai/org/ceoAgent";
import type { OrgAction } from "@/lib/ai/org/orgCoordinator";
import type { OrgContext } from "@/lib/ai/org/orgContext";

export function runGrowth(ctx: OrgContext, ceoDirectives: CeoDirective[]): OrgAction[] {
  const actions: OrgAction[] = [];
  if (ceoDirectives.includes("FOCUS_CONVERSION")) {
    actions.push({ type: "experiment" });
  }
  if (ctx.traffic > 1000) {
    actions.push({ type: "variant" });
  }
  return actions;
}
