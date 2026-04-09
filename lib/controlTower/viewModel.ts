/**
 * Unified view model for Control Tower snapshot (additive).
 * Tolererer både rå API-kropp og { ok, data }-konvolutter.
 */

import { demoData } from "@/lib/demo/data";
import { isDemoMode } from "@/lib/demo/mode";

function unwrapEnvelope(p: unknown): unknown {
  if (p && typeof p === "object" && "ok" in p && (p as { ok?: unknown }).ok === true && "data" in p) {
    return (p as { data: unknown }).data;
  }
  return p;
}

export type ControlViewModel = {
  revenue: number;
  forecast: number;
  leads: number;
  actions: unknown[];
  health: string;
  healthLevel: "ok" | "warning" | "critical" | "unknown";
  trendDirection: "up" | "down" | "flat" | "unknown";
  activeAlerts: number;
  criticalAlerts: number;
};

function trendFromControl(c: Record<string, unknown> | null): "up" | "down" | "flat" | "unknown" {
  const pred = c?.predictive && typeof c.predictive === "object" ? (c.predictive as Record<string, unknown>) : null;
  const trend = pred?.trend && typeof pred.trend === "object" ? (pred.trend as Record<string, unknown>) : null;
  const d = trend?.direction;
  if (d === "up" || d === "down" || d === "flat") return d;
  return "unknown";
}

function alertsFromControl(c: Record<string, unknown> | null, healthRaw: unknown): { active: number; critical: number } {
  const fa = c?.financialAlerts && typeof c.financialAlerts === "object" ? (c.financialAlerts as Record<string, unknown>) : null;
  const triggered = Array.isArray(fa?.triggered) ? fa.triggered : [];
  const active = triggered.length;
  let high = 0;
  for (const row of triggered) {
    if (row && typeof row === "object" && (row as { severity?: unknown }).severity === "high") {
      high += 1;
    }
  }
  const systemCritical = healthRaw === "critical" ? 1 : 0;
  return { active, critical: high + systemCritical };
}

export function buildControlView(snapshot: unknown): ControlViewModel {
  if (isDemoMode()) {
    return { ...demoData };
  }

  const s = unwrapEnvelope(snapshot) as Record<string, unknown> | null | undefined;

  const control = unwrapEnvelope(s?.control);
  const ceo = unwrapEnvelope(s?.ceo);
  const revenue = unwrapEnvelope(s?.revenue);
  const growth = unwrapEnvelope(s?.growth);

  const c = control && typeof control === "object" ? (control as Record<string, unknown>) : null;
  const sys = c?.system && typeof c.system === "object" ? (c.system as Record<string, unknown>) : null;

  const ceoSnap =
    ceo && typeof ceo === "object" && "snapshot" in ceo && (ceo as { snapshot?: unknown }).snapshot
      ? ((ceo as { snapshot: unknown }).snapshot as Record<string, unknown>)
      : null;

  const rev =
    revenue && typeof revenue === "object" ? (revenue as Record<string, unknown>) : null;
  const revenueN = typeof rev?.revenue === "number" && Number.isFinite(rev.revenue) ? rev.revenue : 0;

  const forecast =
    typeof ceoSnap?.forecast === "number" && Number.isFinite(ceoSnap.forecast) ? ceoSnap.forecast : 0;
  const leads = typeof ceoSnap?.leads === "number" && Number.isFinite(ceoSnap.leads) ? ceoSnap.leads : 0;

  const ceoActions = Array.isArray(ceoSnap?.actions) ? [...ceoSnap.actions] : [];
  const growthObj = growth && typeof growth === "object" ? (growth as Record<string, unknown>) : null;
  const growthActions = Array.isArray(growthObj?.actions) ? [...growthObj.actions] : [];

  const healthRaw = sys?.health;
  const health = typeof healthRaw === "string" && healthRaw.length ? healthRaw : "unknown";
  const healthLevel: ControlViewModel["healthLevel"] =
    healthRaw === "ok" || healthRaw === "warning" || healthRaw === "critical" ? healthRaw : "unknown";

  const trendDirection = trendFromControl(c);
  const { active: activeAlerts, critical: criticalAlerts } = alertsFromControl(c, healthRaw);

  return {
    revenue: revenueN,
    forecast,
    leads,
    actions: [...ceoActions, ...growthActions],
    health,
    healthLevel,
    trendDirection,
    activeAlerts,
    criticalAlerts,
  };
}
