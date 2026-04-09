import type { OrgContext } from "@/lib/ai/org/orgContext";

export type CeoDirective = "FOCUS_CONVERSION" | "FOCUS_RETENTION" | "START_EXPERIMENTS";

export function runCEO(ctx: OrgContext): CeoDirective[] {
  const decisions: CeoDirective[] = [];
  if (ctx.conversion < 0.02) decisions.push("FOCUS_CONVERSION");
  if (ctx.churn > 0.05) decisions.push("FOCUS_RETENTION");
  if (ctx.experiments === 0) decisions.push("START_EXPERIMENTS");
  return decisions;
}
