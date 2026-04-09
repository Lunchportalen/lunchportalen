"use client";

import { useEffect, useMemo, useState } from "react";

import { detectSecurityAnomalies } from "@/lib/security/anomaly";
import type { SecurityAuditEvent, SecurityDashboardMetrics } from "@/lib/security/dashboardAudit";

import { ActivityTimeline } from "./ActivityTimeline";
import { AnomalyPanel } from "./AnomalyPanel";
import { AuthAnomalyPanel } from "./AuthAnomalyPanel";
import { RidTracePanel } from "./RidTracePanel";
import { SecurityOverviewCard } from "./SecurityOverviewCard";
import { TenantViolationPanel } from "./TenantViolationPanel";

type TimeRange = "1h" | "24h" | "7d" | "all";

function cutoffMs(range: TimeRange): number | null {
  const now = Date.now();
  if (range === "all") return null;
  if (range === "1h") return now - 60 * 60 * 1000;
  if (range === "24h") return now - 24 * 60 * 60 * 1000;
  return now - 7 * 24 * 60 * 60 * 1000;
}

type Props = {
  initialEvents: SecurityAuditEvent[];
  metrics: SecurityDashboardMetrics;
  loadError: string | null;
};

export function SecurityDashboardClient({ initialEvents, metrics, loadError }: Props) {
  const [actionFilter, setActionFilter] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [traceRid, setTraceRid] = useState<string | null>(null);

  const actionOptions = useMemo(() => {
    const s = new Set<string>();
    for (const e of initialEvents) {
      if (e.action) s.add(e.action);
    }
    return Array.from(s).sort();
  }, [initialEvents]);

  const roleOptions = useMemo(() => {
    const s = new Set<string>();
    for (const e of initialEvents) {
      if (e.actor_role) s.add(e.actor_role);
    }
    return Array.from(s).sort();
  }, [initialEvents]);

  const filtered = useMemo(() => {
    const cut = cutoffMs(timeRange);
    return initialEvents.filter((e) => {
      if (cut !== null) {
        const t = Date.parse(e.created_at);
        if (!Number.isFinite(t) || t < cut) return false;
      }
      if (actionFilter && e.action !== actionFilter) return false;
      if (roleFilter && e.actor_role !== roleFilter) return false;
      return true;
    });
  }, [initialEvents, timeRange, actionFilter, roleFilter]);

  const tenantViolations = useMemo(
    () => filtered.filter((e) => e.action === "TENANT_VIOLATION"),
    [filtered],
  );

  const authAnomalies = useMemo(() => {
    return filtered.filter(
      (e) =>
        e.action === "ACCESS_DENIED" ||
        (e.action === "LOGIN" && String(e.detail?.outcome ?? "") === "failure"),
    );
  }, [filtered]);

  const securityAnomalies = useMemo(() => detectSecurityAnomalies(initialEvents), [initialEvents]);

  useEffect(() => {
    if (loadError) return;
    const critical = securityAnomalies.filter((a) => a.severity === "CRITICAL");
    critical.forEach((a) => {
      void fetch("/api/security/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(a),
      }).catch(() => {});
    });
  }, [securityAnomalies, loadError]);

  return (
    <div className="space-y-8">
      {loadError ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          {loadError} Viser tomt utvalg; øvrig backoffice påvirkes ikke.
        </div>
      ) : null}

      <AnomalyPanel anomalies={securityAnomalies} />

      <SecurityOverviewCard metrics={metrics} />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-slate-900">Filter</h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex min-w-[160px] flex-col gap-1 text-xs font-medium text-slate-600">
            Handling
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Alle</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[160px] flex-col gap-1 text-xs font-medium text-slate-600">
            Rolle
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Alle</option>
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[160px] flex-col gap-1 text-xs font-medium text-slate-600">
            Tidsrom
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="1h">Siste time</option>
              <option value="24h">Siste 24 t</option>
              <option value="7d">Siste 7 d</option>
              <option value="all">Hele uttrekket</option>
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <TenantViolationPanel events={tenantViolations} />
        <AuthAnomalyPanel events={authAnomalies} />
      </div>

      <ActivityTimeline events={filtered} onSelect={(ev) => setTraceRid(ev.effectiveRid)} />

      <RidTracePanel rid={traceRid} events={initialEvents} onClose={() => setTraceRid(null)} />
    </div>
  );
}
