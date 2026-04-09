/**
 * Anomalideteksjon — regelbasert, forklarbar (ikke «black box» ML).
 */

import type { DailyDemandAgg } from "@/lib/ai/demandData";

export type AnomalyAlert = {
  code: string;
  severity: "info" | "warn" | "critical";
  message: string;
  dataUsed: string[];
};

export function detectOperationalAnomalies(input: {
  history: DailyDemandAgg[];
  hindcastError: number | null;
  cityLoadRatios: Array<{ city: string; ratio: number }>;
}): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  const recent = input.history.slice(-10);

  if (recent.length >= 5) {
    const last = recent[recent.length - 1]!;
    const prev = recent[recent.length - 2]!;
    const drop = prev.activeCount > 0 ? (prev.activeCount - last.activeCount) / prev.activeCount : 0;
    if (prev.activeCount >= 8 && drop >= 0.45) {
      alerts.push({
        code: "ORDER_DROP",
        severity: "warn",
        message: `Brå nedgang i aktive ordre siste dag (${(drop * 100).toFixed(0)} %) — verifiser kommunikasjon og bestillingsfrist.`,
        dataUsed: ["activeCount day-over-day"],
      });
    }
  }

  if (recent.length >= 4) {
    let wasteish = 0;
    for (const d of recent) {
      const c = d.cancelledBeforeCutoff + d.cancelledAfterCutoff;
      if (d.activeCount > 0 && c / Math.max(1, d.activeCount + c) >= 0.35) wasteish += 1;
    }
    if (wasteish >= 3) {
      alerts.push({
        code: "WASTE_PATTERN",
        severity: "warn",
        message: "Uvanlig høy andel avbestillinger relativt til volum — vurder porsjonsplan og cut-off.",
        dataUsed: ["cancelled_before_cutoff", "cancelled_after_cutoff", "activeCount"],
      });
    }
  }

  const he = input.hindcastError;
  if (he != null && Number.isFinite(he) && Math.abs(he) >= 12) {
    alerts.push({
      code: "FORECAST_DRIFT",
      severity: "info",
      message: `Stor prognoseavvik (hindcast): ${he > 0 ? "+" : ""}${he} porsjoner — kalibrer buffer.`,
      dataUsed: ["hindcast error"],
    });
  }

  for (const c of input.cityLoadRatios) {
    if (c.ratio >= 1.05) {
      alerts.push({
        code: "CITY_OVERCAP",
        severity: "critical",
        message: `${c.city}: belastning over nominell kapasitet (${(c.ratio * 100).toFixed(0)} %) — vurder omfordeling før godkjenning.`,
        dataUsed: ["city demand/capacity ratio"],
      });
    }
  }

  if (recent.length >= 6) {
    const stops = recent.map((d) => d.cancelledAfterCutoff);
    const max = Math.max(...stops);
    if (max >= 4) {
      alerts.push({
        code: "DELIVERY_FRICTION",
        severity: "warn",
        message: "Flere avbestillinger etter cut-off — mulig friksjon i leveranse/kommunikasjon.",
        dataUsed: ["cancelled_after_cutoff"],
      });
    }
  }

  return alerts;
}
