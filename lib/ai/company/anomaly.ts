/**
 * STEP 8 — Deterministic anomaly flags (no ML). Caller may halt autopilot.
 */

import type { CompanySnapshot } from "./types";

export type CompanyAnomalyKind = "revenue_drop" | "traffic_spike" | "health_degraded" | "error_burst" | "ux_hint";

export type CompanyAnomaly = {
  kind: CompanyAnomalyKind;
  severity: "warn" | "critical";
  message: string;
  metrics?: Record<string, number>;
};

/** Thresholds are conservative — flag for human review, not auto-fix. */
export function detectCompanyAnomalies(snapshot: CompanySnapshot, baseline?: { ctr: number | null }): CompanyAnomaly[] {
  const out: CompanyAnomaly[] = [];
  const ctr = snapshot.revenue.ctr;
  const baseCtr = baseline?.ctr;

  if (snapshot.systemHealth.status === "degraded" || snapshot.systemHealth.status === "down") {
    out.push({
      kind: "health_degraded",
      severity: "critical",
      message: `System health: ${snapshot.systemHealth.status}${snapshot.systemHealth.detail ? ` (${snapshot.systemHealth.detail})` : ""}.`,
    });
  }

  if (snapshot.systemHealth.errors24h >= 25) {
    out.push({
      kind: "error_burst",
      severity: "warn",
      message: "Høyt antall feil siste døgn — vurder stabilitet før autopilot.",
      metrics: { errors24h: snapshot.systemHealth.errors24h },
    });
  }

  if (baseCtr != null && ctr != null && baseCtr > 0.02 && ctr < baseCtr * 0.45) {
    out.push({
      kind: "revenue_drop",
      severity: "warn",
      message: "CTR falt kraftig vs. baseline — mulig konverteringsproblem.",
      metrics: { ctr, baseCtr },
    });
  }

  const pv = snapshot.revenue.pageViews24h;
  if (pv > 50_000) {
    out.push({
      kind: "traffic_spike",
      severity: "warn",
      message: "Uvanlig høy trafikk siste døgn — verifiser at tall er forventet.",
      metrics: { pageViews24h: pv },
    });
  }

  if (snapshot.design.weakPointsCount >= 4 && (ctr != null && ctr < 0.02)) {
    out.push({
      kind: "ux_hint",
      severity: "warn",
      message: "Mange design-svakheter samtidig med lav CTR — manuell gjennomgang anbefalt.",
      metrics: { weakPoints: snapshot.design.weakPointsCount, ctr },
    });
  }

  return out;
}
