import "server-only";

import { opsLog } from "@/lib/ops/log";

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

/**
 * Safe mode: no SMTP. Logs intent when {@code ALERT_EMAIL_ENABLED=true}.
 */
export async function sendAlertEmail(message: string): Promise<{ ok: boolean }> {
  if (safeTrim(process.env.ALERT_EMAIL_ENABLED) !== "true") {
    return { ok: false };
  }

  opsLog("email_alert_sent", { message });
  return { ok: true };
}
