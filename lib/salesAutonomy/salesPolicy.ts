import type { AutonomyRuntimeConfig } from "@/lib/salesAutonomy/types";
import { isAutonomyEnvUnlocked } from "@/lib/salesAutonomy/config";

export type SalesPolicyGate = { ok: true } | { ok: false; reason: string };

export function canExecuteSalesAction(
  action: { approved?: boolean; risk?: "low" | "medium" | "high" },
  config: AutonomyRuntimeConfig,
): SalesPolicyGate {
  if (!isAutonomyEnvUnlocked()) {
    return { ok: false, reason: "env_kill_switch" };
  }
  if (!config.enabled) {
    return { ok: false, reason: "autonomy_disabled" };
  }
  if (config.requireApproval && !action.approved) {
    return { ok: false, reason: "approval_required" };
  }
  if (action.risk === "high") {
    return { ok: false, reason: "high_risk" };
  }
  return { ok: true };
}
