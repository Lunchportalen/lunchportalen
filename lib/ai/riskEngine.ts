import "server-only";

import { opsLog } from "@/lib/ops/log";

const HIGH_RISK = ["DELETE_DATA", "OVERRIDE_PROD", "FORCE_PUBLISH"] as const;

export type RiskVerdict = "BLOCK" | "ALLOW";

/**
 * Hard blocklist for any autonomous execution path (explainable, deterministic).
 */
export function evaluateRisk(action: string): RiskVerdict {
  const a = String(action ?? "").trim();
  if ((HIGH_RISK as readonly string[]).includes(a)) {
    opsLog("blackbox_risk_block", { action: a, reason: "high_risk_list" });
    return "BLOCK";
  }
  return "ALLOW";
}
