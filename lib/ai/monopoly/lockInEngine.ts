import type { BusinessState } from "@/lib/ai/businessStateEngine";

export function buildLockIn(ctx: Pick<BusinessState, "churn" | "experiments">): string[] {
  const mechanisms: string[] = [];
  if (ctx.churn > 0.03) {
    mechanisms.push("INCREASE_SWITCHING_COST");
  }
  if (ctx.experiments > 5) {
    mechanisms.push("PERSONALIZATION_LOCK");
  }
  return mechanisms;
}
