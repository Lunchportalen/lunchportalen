import type { SecurityAnomaly } from "@/lib/security/anomaly";

const typeLabel: Record<SecurityAnomaly["type"], string> = {
  TENANT_ATTACK: "Tenant-bølge",
  ACCESS_ANOMALY: "Tilgang avvist",
  LOGIN_ATTACK: "Innlogging",
  AI_ABUSE: "AI-bruk",
};

type Props = {
  anomalies: SecurityAnomaly[];
};

export function AnomalyPanel({ anomalies }: Props) {
  if (anomalies.length === 0) {
    return (
      <section
        className="rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 text-sm text-slate-600"
        aria-label="Anomalideteksjon"
      >
        <span className="font-medium text-slate-700">Anomalier (10 min):</span> ingen signal over terskel.
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-label="Anomalideteksjon">
      <h2 className="text-sm font-semibold text-slate-900">Anomalier (siste 10 min)</h2>
      <p className="text-xs text-slate-600">
        Kun lesing av utvalgte hendelser. Sammenlignet med forrige 10 minutter (↑ ved økning).
      </p>
      <ul className="space-y-3">
        {anomalies.map((a) => {
          const isCritical = a.severity === "CRITICAL";
          const banner =
            isCritical
              ? "border-red-300 bg-red-50 text-red-950"
              : "border-amber-200 bg-amber-50 text-amber-950";
          return (
            <li
              key={a.type}
              className={`rounded-xl border px-4 py-3 shadow-sm ${banner}`}
              role="status"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">
                  {typeLabel[a.type]}
                  {a.trend === "up" ? (
                    <span className="ml-2 inline-block font-bold text-current" title="Høyere enn forrige 10 min">
                      ↑
                    </span>
                  ) : null}
                </span>
                <span className="text-xs font-medium uppercase tracking-wide opacity-90">
                  {a.severity === "CRITICAL" ? "Kritisk" : "Advarsel"} · {a.count} hendelser
                </span>
              </div>
              <p className="mt-2 text-sm opacity-95">{a.explanation}</p>
              <p className="mt-1 text-xs opacity-80">
                Forrige 10 min: {a.previousWindowCount} · Nå: {a.count}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
