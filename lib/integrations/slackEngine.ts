import "server-only";

import { opsLog } from "@/lib/ops/log";

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

export async function sendSlackAlert(message: string): Promise<void> {
  const url = safeTrim(process.env.SLACK_WEBHOOK_URL);
  if (!url) {
    opsLog("slack_disabled", { reason: "missing_webhook" });
    return;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      opsLog("slack_alert_failed", { status: res.status, detail: await res.text().catch(() => "") });
      return;
    }
    opsLog("slack_alert_sent", { message });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    opsLog("slack_alert_failed", { error });
  }
}
