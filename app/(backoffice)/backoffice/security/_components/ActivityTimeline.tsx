"use client";

import type { SecurityAuditEvent } from "@/lib/security/dashboardAudit";

type Props = {
  events: SecurityAuditEvent[];
  onSelect: (ev: SecurityAuditEvent) => void;
};

export function ActivityTimeline({ events, onSelect }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Aktivitetslinje</h2>
      <p className="mt-1 text-xs text-slate-600">Klikk en rad for RID-spor i utvalget.</p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Handling</th>
              <th className="px-3 py-2">Bruker</th>
              <th className="px-3 py-2">Rolle</th>
              <th className="px-3 py-2">Ressurs</th>
              <th className="px-3 py-2">Tid</th>
              <th className="px-3 py-2">RID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Ingen rader for gjeldende filter.
                </td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr key={ev.id}>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onSelect(ev)}
                      className="text-left font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    >
                      {ev.action ?? "—"}
                    </button>
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-2 font-mono text-xs text-slate-700">
                    {ev.actor_user_id ?? ev.actor_email ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{ev.actor_role ?? "—"}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-slate-700" title={ev.entity_type ?? ""}>
                    {ev.entity_type ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">{ev.created_at}</td>
                  <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs text-slate-600">
                    {ev.effectiveRid}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
