import "server-only";

import type { AutonomyPolicyContext, MappedAutonomyAction } from "@/lib/ai/autonomy/types";

const MIN_EXECUTE_CONFIDENCE = 0.62;

function safeRole(r: string | null | undefined): string {
  return String(r ?? "").trim().toLowerCase();
}

/**
 * Hard guard for autonomous layer. Log-only execution still requires passing policy.
 * - publish → superadmin or manualConfirm
 * - experiments → safe (log / preview path)
 * - AI content → preview-only (safe at policy level)
 * - system / bug_fix → never auto mutate — allow log-only
 */
export function canExecuteAutonomy(
  decision: MappedAutonomyAction,
  context: AutonomyPolicyContext,
): { ok: boolean; reason: string } {
  if (decision.confidence < MIN_EXECUTE_CONFIDENCE) {
    return { ok: false, reason: `confidence_below_${MIN_EXECUTE_CONFIDENCE}` };
  }

  const role = safeRole(context.role);

  if (context.allowSystem === true && role === "superadmin" && !context.userId) {
    if (decision.kind === "publish") {
      return { ok: false, reason: "publish_never_auto_on_cron" };
    }
    return { ok: true, reason: "cron_log_only_non_publish" };
  }

  if (!context.userId && !context.allowSystem) {
    return { ok: false, reason: "missing_user" };
  }

  if (decision.kind === "publish") {
    if (context.manualConfirm === true && role === "superadmin") {
      return { ok: true, reason: "superadmin_manual_confirm" };
    }
    if (role === "superadmin") {
      return { ok: true, reason: "superadmin_publish_ack_log_only" };
    }
    return { ok: false, reason: "publish_requires_superadmin" };
  }

  if (decision.kind === "experiment") {
    return { ok: true, reason: "experiment_safe_log" };
  }

  if (decision.kind === "content_improve" || decision.kind === "seo_fix") {
    return { ok: true, reason: "ai_preview_safe_log" };
  }

  if (decision.kind === "bug_fix") {
    return { ok: true, reason: "cto_suggestions_log_only" };
  }

  return { ok: false, reason: "unknown_kind" };
}
