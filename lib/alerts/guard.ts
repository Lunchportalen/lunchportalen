/**
 * Enkel deduplisering per varseltype — 30 minutters kjøling (prosess-lokal).
 */

import type { Alert, AlertType } from "@/lib/alerts/types";

const seen = new Map<string, number>();

const COOLDOWN_MS = 1000 * 60 * 30;

export function shouldSend(alert: Alert): boolean {
  const key = alert.type;
  const last = seen.get(key);
  const now = Date.now();
  if (last != null && now - last < COOLDOWN_MS) {
    return false;
  }
  seen.set(key, now);
  return true;
}

export function applyCooldownGate(alerts: Alert[]): {
  sent: Alert[];
  suppressed: Array<{ type: AlertType; reason: string }>;
} {
  const sent: Alert[] = [];
  const suppressed: Array<{ type: AlertType; reason: string }> = [];
  for (const alert of alerts) {
    if (!shouldSend(alert)) {
      suppressed.push({ type: alert.type, reason: "cooldown_30m" });
      continue;
    }
    sent.push(alert);
  }
  return { sent, suppressed };
}

/** Kun til tester — nullstiller kjølingsminne. */
export function clearFinancialAlertCooldownForTests(): void {
  seen.clear();
}
