/**
 * Operasjonsovervåkning — ikke-blokkerende varsler (lesbare signaler).
 */

import type { DailyDemandAgg } from "@/lib/ai/demandData";

export type OpsAlert = {
  severity: "info" | "warn";
  code: string;
  message: string;
  dataUsed: string[];
};

export type OpsMonitorOutput = {
  alerts: OpsAlert[];
  transparency: string[];
};

export function monitorOperations(history: DailyDemandAgg[], opts?: { lastNDays?: number }): OpsMonitorOutput {
  const n = Math.min(30, Math.max(3, opts?.lastNDays ?? 10));
  const today = history.length ? history[history.length - 1]!.date : "";
  const slice = today ? history.filter((h) => h.date > today || history.slice(-n).includes(h)) : history.slice(-n);

  const recent = history.slice(-n);
  const alerts: OpsAlert[] = [];
  const transparency = [
    "Varsler er heuristiske — ingen automatisk eskalering eller bestilling.",
    "Basert på daglige ordretellinger (ACTIVE / avbestillinger i aggregat).",
  ];

  if (recent.length < 3) {
    alerts.push({
      severity: "info",
      code: "LOW_HISTORY",
      message: "For få dager med data til robust driftsovervåkning.",
      dataUsed: ["orders aggregate"],
    });
    return { alerts, transparency };
  }

  let cancelSpike = 0;
  let volSwing = 0;
  for (let i = 1; i < recent.length; i++) {
    const a = recent[i - 1]!;
    const b = recent[i]!;
    const c = b.cancelledAfterCutoff + b.cancelledBeforeCutoff;
    if (c >= 2) cancelSpike += 1;
    const swing = Math.abs(b.activeCount - a.activeCount);
    if (swing >= Math.max(5, a.activeCount * 0.35)) volSwing += 1;
  }

  if (cancelSpike >= 2) {
    alerts.push({
      severity: "warn",
      code: "CANCEL_PATTERN",
      message: "Flere dager med påfallende avbestillingsmønster — sjekk kommunikasjon og cut-off.",
      dataUsed: ["cancelled_before_cutoff", "cancelled_after_cutoff"],
    });
  }

  if (volSwing >= 2) {
    alerts.push({
      severity: "info",
      code: "VOLUME_SWING",
      message: "Stor dag-til-dag variasjon i aktive porsjoner — vurder buffer i produksjon.",
      dataUsed: ["activeCount per day"],
    });
  }

  return { alerts, transparency };
}
