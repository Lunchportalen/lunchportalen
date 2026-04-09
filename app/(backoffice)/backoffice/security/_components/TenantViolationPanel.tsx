import type { SecurityAuditEvent } from "@/lib/security/dashboardAudit";

function mismatchLabel(ev: SecurityAuditEvent): string {
  const d = ev.detail ?? {};
  const req = d.requestedCompanyId != null ? String(d.requestedCompanyId) : "";
  const ctxCo = d.company_id != null ? String(d.company_id) : "";
  const bodyCo = d.bodyCompanyId != null ? String(d.bodyCompanyId) : "";
  const code = d.code != null ? String(d.code) : "";

  if (code === "IDENTITY_MISMATCH") return "Bruker-ID i forespørsel ≠ sesjon";
  if (bodyCo && ctxCo) return `Forespurt company ${bodyCo.slice(0, 8)}… ≠ scope ${ctxCo.slice(0, 8)}…`;
  if (req && ctxCo) return `Forespurt ${req.slice(0, 8)}… ≠ profil ${ctxCo.slice(0, 8)}…`;
  if (req) return `Forespurt company: ${req}`;
  if (ctxCo) return `Sesjons-scope: ${ctxCo}`;
  return ev.summary ?? "—";
}

type Props = {
  events: SecurityAuditEvent[];
};

export function TenantViolationPanel({ events }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Tenant-brudd</h2>
      <p className="mt-1 text-xs text-slate-600">Nylige forsøk (TENANT_VIOLATION) fra audit.</p>
      <ul className="mt-4 divide-y divide-slate-100">
        {events.length === 0 ? (
          <li className="py-4 text-sm text-slate-500">Ingen hendelser i gjeldende filter.</li>
        ) : (
          events.map((ev) => (
            <li key={ev.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-mono text-slate-600">{ev.effectiveRid}</span>
                <time className="text-xs text-slate-500" dateTime={ev.created_at}>
                  {ev.created_at}
                </time>
              </div>
              <p className="mt-1 text-sm text-slate-800">{mismatchLabel(ev)}</p>
              <p className="mt-1 text-xs text-slate-500">
                Bruker: {ev.actor_user_id ?? "—"} · Rolle: {ev.actor_role ?? "—"}
              </p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
