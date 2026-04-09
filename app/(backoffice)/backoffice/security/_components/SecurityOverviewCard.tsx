import type { SecurityDashboardMetrics } from "@/lib/security/dashboardAudit";

const healthStyles: Record<SecurityDashboardMetrics["health"], string> = {
  OK: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
  WARNING: "border-amber-200 bg-amber-50/80 text-amber-950",
  CRITICAL: "border-red-200 bg-red-50/80 text-red-950",
};

const healthLabel: Record<SecurityDashboardMetrics["health"], string> = {
  OK: "OK",
  WARNING: "Advarsel",
  CRITICAL: "Kritisk",
};

type Props = {
  metrics: SecurityDashboardMetrics;
};

export function SecurityOverviewCard({ metrics }: Props) {
  const box = "rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm";
  const statLabel = "text-xs font-medium uppercase tracking-wide text-slate-500";
  const statValue = "mt-1 text-2xl font-semibold tabular-nums text-slate-900";

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Oversikt</h2>
          <p className="mt-1 text-xs text-slate-600">Siste 24 timer (aggregert i dashbordet).</p>
        </div>
        <div
          className={`rounded-xl border px-4 py-2 text-sm font-semibold ${healthStyles[metrics.health]}`}
          role="status"
        >
          Status: {healthLabel[metrics.health]}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={box}>
          <p className={statLabel}>Hendelser (24 t)</p>
          <p className={statValue}>{metrics.totalEvents24h}</p>
        </div>
        <div className={box}>
          <p className={statLabel}>Tenant-brudd</p>
          <p className={statValue}>{metrics.tenantViolations24h}</p>
        </div>
        <div className={box}>
          <p className={statLabel}>Mislykket innlogging</p>
          <p className={statValue}>{metrics.failedLogins24h}</p>
        </div>
        <div className={box}>
          <p className={statLabel}>AI-kjøringer</p>
          <p className={statValue}>{metrics.aiExecutions24h}</p>
        </div>
      </div>

      {metrics.metricsSource === "sample" ? (
        <p className="mt-4 text-xs text-slate-500">
          Telling 24 t er basert på de siste hendelsene i utvalget (begrenset uttrekk).
        </p>
      ) : null}
    </section>
  );
}
