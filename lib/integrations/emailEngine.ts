import "server-only";

import { INTEGRATIONS } from "@/lib/integrations/config";
import { opsLog } from "@/lib/ops/log";

export type SendEmailSequenceResult = {
  ok: boolean;
  sent: boolean;
  mode: "logged_only" | "disabled";
  detail?: string;
};

/**
 * Safe mode: no outbound SMTP/Mailchimp unless explicitly extended later. Always fully logged when enabled.
 */
export async function sendEmailSequence(
  action: unknown,
  ctx: { rid: string },
): Promise<SendEmailSequenceResult> {
  if (!INTEGRATIONS.email.enabled) {
    opsLog("email_sequence_skipped", { rid: ctx.rid, reason: "EMAIL_ENABLED_not_true", action });
    return { ok: false, sent: false, mode: "disabled", detail: "EMAIL_DISABLED" };
  }

  opsLog("email_sequence", { rid: ctx.rid, action, note: "safe_mode_no_external_send" });
  return {
    ok: true,
    sent: false,
    mode: "logged_only",
    detail: "audit_only_no_external_send",
  };
}
