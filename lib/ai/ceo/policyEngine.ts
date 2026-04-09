import "server-only";

import type { CeoGrowthAction, CeoPolicyContext } from "@/lib/ai/ceo/types";

const MIN_AUTO_CONFIDENCE = 0.7;

function safeRole(r: string | null | undefined): string {
  return String(r ?? "").trim().toLowerCase();
}

/**
 * Policy gate for any automated side-effect. RC-safe defaults: no destructive auto-exec.
 * - publish → only superadmin may even request execution (caller still must not auto-publish).
 * - experiment → superadmin only in backoffice context (company_admin has no backoffice).
 * - content / seo → allowed at policy level; automation engine remains no-op for mutations.
 */
export function canExecute(action: CeoGrowthAction, context: CeoPolicyContext): { ok: boolean; reason: string } {
  if (action.confidence < MIN_AUTO_CONFIDENCE) {
    return { ok: false, reason: `confidence_below_${MIN_AUTO_CONFIDENCE}` };
  }
  const role = safeRole(context.role);
  if (!context.userId && !(context.allowSystem === true && role === "superadmin")) {
    return { ok: false, reason: "missing_user" };
  }
  /** Cron / motor: log-only path, no end-user UUID — never bypass when a real user id is present. */
  if (context.allowSystem === true && role === "superadmin" && !context.userId) {
    return { ok: true, reason: "system_cron_log_only_superadmin_gate" };
  }

  switch (action.decisionType) {
    case "publish":
      if (role !== "superadmin") {
        return { ok: false, reason: "publish_requires_superadmin" };
      }
      return { ok: true, reason: "superadmin_publish_policy_ok_no_auto_side_effects" };
    case "experiment":
      if (role !== "superadmin") {
        return { ok: false, reason: "experiment_requires_superadmin" };
      }
      return { ok: true, reason: "superadmin_experiment_policy_ok_no_auto_side_effects" };
    case "seo_fix":
    case "content_improve":
      if (role !== "superadmin") {
        return { ok: false, reason: "content_actions_require_superadmin_in_backoffice" };
      }
      return { ok: true, reason: "superadmin_content_policy_ok_no_auto_side_effects" };
    default:
      return { ok: false, reason: "unknown_decision_type" };
  }
}
