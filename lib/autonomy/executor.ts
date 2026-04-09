/**
 * Utførelse — live er fail-closed til produksjonskoblinger finnes.
 */

import type { ResolvedAutonomyPolicy } from "@/lib/autonomy/policy";
import type { ActionExecutionResult, AutonomousAction, AutonomousRunMode } from "@/lib/autonomy/types";

export async function executeAction(
  action: AutonomousAction,
  mode: AutonomousRunMode,
  policy: ResolvedAutonomyPolicy,
): Promise<ActionExecutionResult> {
  if (mode === "dry_run") {
    return {
      actionType: action.type,
      status: "dry_run",
      message: "Simulering — ingen sideeffekt.",
    };
  }
  if (!policy.enabled) {
    return { actionType: action.type, status: "blocked", reason: "policy_disabled" };
  }
  return {
    actionType: action.type,
    status: "blocked",
    reason: "executor_not_wired",
    message: "Live-utfører er ikke koblet til produksjons-API (bevisst stopp).",
  };
}
