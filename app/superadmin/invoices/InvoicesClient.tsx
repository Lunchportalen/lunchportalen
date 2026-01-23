"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function InvoicesClient() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setErr(null);
    setLoading(true);
    const res = await fetch("/api/superadmin/invoices/runs", { cache: "no-store" }).catch(() => null);
    if (!res || !res.ok) {
      setErr("Kunne ikke hente fakturakjøringer (sjekk innlogging/rolle).");
      setRuns([]);
      setLoading(false);
      return;
    }
    const data = await res.json().catch(() => ({}));
    setRuns(Array.isArray(data?.runs) ? data.runs : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const count = useMemo(() => runs.length, [runs]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[rgb(var(--lp-text))]">Fakturakjøringer</h1>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
            Snapshot-kjøringer med eksport og Tripletex-mapping.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="rounded-xl bg-white/60 px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white"
          >
            Oppdater
          </button>
          <Link
            href="/superadmin"
            className="rounded-xl bg-white/60 px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white"
          >
            Tilbake
          </Link>
        </div>
      </div>

      <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-4 shadow-sm ring-1 ring-[rgb(var(--lp-border))]">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-medium text-[rgb(var(--lp-text))]">Kjøringer</div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">{count} stk</div>
        </div>

        {err ? <div className="mb-3 text-sm text-red-600">{err}</div> : null}

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
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-[rgb(var(--lp-muted))]">
                    Laster…
                  </td>
                </tr>
              ) : !runs.length ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-[rgb(var(--lp-muted))]">
                    Ingen fakturakjøringer funnet.
                  </td>
                </tr>
              ) : (
                runs.map((r) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
