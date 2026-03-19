// lib/observability/statusAggregator.ts
// Single source of truth for current operational status. Uses health checks + SLIs + alerts.
// Dashboard aggregation: GET /api/superadmin/system/status returns getOperationalStatus(admin).
// Use this module (and OperationalStatus from ./types) as the canonical dashboard payload; do not duplicate aggregation logic elsewhere.
import "server-only";

import { runHealthChecks } from "@/lib/system/health";
import { deriveSystemStatus, deriveReasons } from "@/lib/system/healthStatus";
import type { HealthStatus } from "@/lib/system/health";
import type { OperationalStatus, AlertState } from "./types";
import { computeAllSlis } from "./sli";
import { evaluateAlerts, hasCriticalAlert } from "./alertEvaluator";
import { makeRid } from "@/lib/http/respond";

type CheckStatus = "OK" | "WARN" | "FAIL";

function mapHealthStatus(s: HealthStatus): CheckStatus {
  if (s === "ok") return "OK";
  if (s === "fail") return "FAIL";
  return "WARN";
}

/**
 * Canonical operational status: health checks, SLIs, alerts, open incidents.
 * Use this (or the GET /api/superadmin/system/status endpoint) as the single source of truth.
 */
export async function getOperationalStatus(admin: {
  from: (table: string) => {
    select: (cols: string, opts?: { count: "exact" }) => any;
    gte: (col: string, val: string) => any;
    in: (col: string, vals: string[]) => any;
    eq: (col: string, val: string) => any;
  };
}): Promise<OperationalStatus> {
  const rid = makeRid();
  const ts = new Date().toISOString();

  // 1) Health report (existing)
  let healthReport: Awaited<ReturnType<typeof runHealthChecks>>;
  try {
    healthReport = await runHealthChecks();
  } catch (e) {
    return {
      status: "critical",
      ts,
      rid,
      checks: [{ key: "health_run", status: "FAIL", message: "runHealthChecks kastet." }],
      slos: [],
      alerts: [],
      openIncidentsByType: {},
      reasons: ["Health-sjekk feilet."],
    };
  }

  const checks = (Array.isArray(healthReport.checks) ? healthReport.checks : []).map((c: any) => ({
    key: String(c.key ?? "unknown"),
    status: mapHealthStatus(c.status as HealthStatus) as CheckStatus,
    message: String(c.message ?? ""),
  }));

  const derivedStatus = deriveSystemStatus(checks);
  const reasons = deriveReasons(checks);

  // 2) SLIs (60 min window for most; 24h for cron where relevant is in sli.ts)
  let slis: Awaited<ReturnType<typeof computeAllSlis>> = [];
  try {
    slis = await computeAllSlis(admin, 60);
  } catch {
    // non-fatal: slos empty, status still from health
  }

  // 3) Alerts from SLIs
  const alerts: AlertState[] = evaluateAlerts(slis, ts);

  // 4) Open incidents count by type
  const openIncidentsByType: Record<string, number> = {};
  try {
    const incRes = await admin.from("system_incidents").select("type").eq("status", "open");
    if (!incRes.error && Array.isArray(incRes.data)) {
      for (const row of incRes.data as { type?: string }[]) {
        const t = String(row?.type ?? "unknown");
        openIncidentsByType[t] = (openIncidentsByType[t] ?? 0) + 1;
      }
    }
  } catch {
    // non-fatal
  }

  // 5) Overall status: critical if health fail or critical alert; degraded if warn or health degraded
  let status: OperationalStatus["status"] = "normal";
  if (derivedStatus === "degraded" || hasCriticalAlert(alerts)) {
    status = hasCriticalAlert(alerts) ? "critical" : "degraded";
  }
  if (checks.some((c) => c.status === "FAIL")) {
    status = "critical";
  }
  const allReasons = [...reasons];
  if (alerts.some((a) => a.severity === "critical")) {
    allReasons.push("SLO-brudd (kritisk).");
  }
  if (alerts.some((a) => a.severity === "warning")) {
    allReasons.push("SLO-advarsel.");
  }

  return {
    status,
    ts,
    rid,
    checks,
    slos: slis,
    alerts,
    openIncidentsByType,
    reasons: allReasons.length ? allReasons : ["Ingen degraderingsårsaker."],
  };
}
