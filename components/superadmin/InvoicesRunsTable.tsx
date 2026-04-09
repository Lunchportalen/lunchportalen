"use client";

// STATUS: KEEP

import Link from "next/link";

type RunRow = {
  id: string;
  period_from: string;
  period_to: string;
  status: string;
  created_at: string;
  note?: string | null;
};

function chip(status: string) {
  const s = String(status ?? "").toLowerCase();
  const base = "inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1";
  if (s === "exported") return `${base} bg-black text-white ring-black`;
  if (s === "generated") return `${base} bg-white/60 text-[rgb(var(--lp-text))] ring-[rgb(var(--lp-border))]`;
  if (s === "cancelled") return `${base} bg-white/60 text-[rgb(var(--lp-muted))] ring-[rgb(var(--lp-border))]`;
  return `${base} bg-white/60 text-[rgb(var(--lp-muted))] ring-[rgb(var(--lp-border))]`;
}

export default function InvoicesRunsTable({ runs }: { runs: RunRow[] }) {
  return (
    <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-4 shadow-sm ring-1 ring-[rgb(var(--lp-border))]">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-[rgb(var(--lp-text))]">Kjøringer</div>
        <div className="text-xs text-[rgb(var(--lp-muted))]">{runs.length} stk</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs text-[rgb(var(--lp-muted))]">
            <tr className="[&>th]:pb-2">
              <th>Periode</th>
              <th>Status</th>
              <th>Opprettet</th>
              <th>Notat</th>
              <th className="text-right">Åpne</th>
            </tr>
          </thead>
          <tbody className="text-[rgb(var(--lp-text))]">
            {runs.map((r) => (
              <tr key={r.id} className="border-t border-[rgb(var(--lp-border))]">
                <td className="py-3">
                  <div className="font-medium">
                    {r.period_from} → {r.period_to}
                  </div>
                  <div className="text-xs text-[rgb(var(--lp-muted))]">{r.id}</div>
                </td>
                <td className="py-3">
                  <span className={chip(r.status)}>{r.status}</span>
                </td>
                <td className="py-3 text-xs text-[rgb(var(--lp-muted))]">{new Date(r.created_at).toISOString()}</td>
                <td className="py-3 text-xs text-[rgb(var(--lp-muted))]">{r.note ?? ""}</td>
                <td className="py-3 text-right">
                  <Link
                    href={`/superadmin/invoices/${r.id}`}
                    className="inline-flex items-center justify-center rounded-xl bg-white/60 px-3 py-2 text-xs ring-1 ring-[rgb(var(--lp-border))] hover:bg-white"
                  >
                    Detaljer
                  </Link>
                </td>
              </tr>
            ))}

            {!runs.length && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-[rgb(var(--lp-muted))]">
                  Ingen fakturakjøringer funnet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
