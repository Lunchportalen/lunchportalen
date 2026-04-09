/**
 * Kapitalbeskyttelse — deterministisk, forklarbar.
 */

import type { ResolvedAutonomyPolicy } from "@/lib/autonomy/policy";

export type CapitalProtectionState = "freeze_ads" | "stop_scaling" | "ok";

export function enforceGlobalCaps(
  context: { totalSpend?: number; roas?: number | null; margin?: number | null },
  policy: ResolvedAutonomyPolicy,
): CapitalProtectionState {
  const spend = typeof context.totalSpend === "number" && Number.isFinite(context.totalSpend) ? context.totalSpend : 0;
  if (spend > policy.maxTotalAdSpend) {
    return "freeze_ads";
  }
  const r = context.roas;
  if (typeof r === "number" && Number.isFinite(r) && r < policy.minROAS) {
    return "stop_scaling";
  }
  const m = context.margin;
  if (typeof m === "number" && Number.isFinite(m) && m < policy.minMargin) {
    return "stop_scaling";
  }
  return "ok";
}
