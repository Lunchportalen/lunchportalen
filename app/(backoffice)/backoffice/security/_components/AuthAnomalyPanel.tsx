import type { SecurityAuditEvent } from "@/lib/security/dashboardAudit";

type Props = {
  events: SecurityAuditEvent[];
};

export function AuthAnomalyPanel({ events }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Autentiseringsanomalier</h2>
      <p className="mt-1 text-xs text-slate-600">ACCESS_DENIED og mislykket LOGIN (outcome=failure).</p>
      <ul className="mt-4 divide-y divide-slate-100">
        {events.length === 0 ? (
          <li className="py-4 text-sm text-slate-500">Ingen hendelser i gjeldende filter.</li>
        ) : (
          events.map((ev) => (
            <li key={ev.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-900">{ev.action}</span>
                <time className="text-xs text-slate-500" dateTime={ev.created_at}>
                  {ev.created_at}
                </time>
              </div>
              <p className="mt-1 font-mono text-xs text-slate-600">{ev.effectiveRid}</p>
              <p className="mt-1 text-xs text-slate-600">
                {ev.entity_type ?? "—"} · {ev.summary ?? "—"}
              </p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
