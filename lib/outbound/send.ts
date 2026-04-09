import "server-only";

import { auditLog } from "@/lib/core/audit";

/**
 * Logs outbound intent only — does not send external email (manual / ESP integration).
 */
export async function sendOutbound(email: string, message: string) {
  const domain = email.includes("@") ? (email.split("@")[1] ?? "").slice(0, 120) : "";
  const preview = String(message ?? "").trim().slice(0, 240);

  await auditLog({
    action: "outbound_pending",
    entity: "sales",
    metadata: {
      email_domain: domain,
      message_preview: preview,
      status: "pending_manual_send",
    },
  });

  return { status: "pending_manual_send" as const };
}
