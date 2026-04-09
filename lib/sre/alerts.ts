import "server-only";

export type SreAlert = {
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
};

const ALERT_TIMEOUT_MS = 5000;

/**
 * Best-effort varsel (webhook + stderr). Kaster aldri.
 */
export async function sendAlert(alert: SreAlert): Promise<void> {
  try {
    console.error("[ALERT]", alert);

    const url = String(process.env.ALERT_WEBHOOK_URL ?? "").trim();
    if (!url) return;

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ALERT_TIMEOUT_MS);
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(alert),
        signal: ac.signal,
      });
    } finally {
      clearTimeout(t);
    }
  } catch {
    /* aldri bryt primærflyt */
  }
}
