"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  name: string;
  status: string;
  primaryMetric: string | null;
  pageId: string | null;
  winnerVariant: string | null;
  variants: Array<{ id?: string; label?: string | null }>;
  createdAt: string;
  deltaRevenue: number | null;
  deltaConversion: number | null;
  deltaErrors: number | null;
  measuredAt: string | null;
};

export default function ExperimentsClient() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/superadmin/experiments", { cache: "no-store", credentials: "same-origin" });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { experiments?: Row[] };
        message?: string;
      };
      if (!json.ok || !json.data?.experiments) {
        setErr(json.message ?? "Kunne ikke laste eksperimenter.");
        return;
      }
      setRows(json.data.experiments);
    } catch {
      setErr("Nettverksfeil.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const labelA = (r: Row) => r.variants?.find((v) => v.id === "A")?.label ?? "A";
  const labelB = (r: Row) => r.variants?.find((v) => v.id === "B")?.label ?? "B";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Eksperimenter</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            A/B for CMS preview (vekst): omsetnings- og konverteringsdelta er proxy i samme strategivindu; feil-delta
            kommer fra observability umiddelbart etter kjøring.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:border-slate-400"
        >
          Oppdater
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">Laster…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {!loading && !err && (
        <section className="flex flex-col gap-3">
          {rows.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
              Ingen eksperimenter ennå. Kjør autonomi med godkjent kopiering og vekst-kontekst (pageId +
              companyId).
            </div>
          )}
          {rows.map((r) => (
            <article
              key={r.id}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm"
            >
              <div className="break-words font-medium text-slate-900">{r.name}</div>
              <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">A vs B</dt>
                  <dd className="text-slate-800">
                    {labelA(r)} · {labelB(r)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Vinner</dt>
                  <dd className="font-medium text-slate-900">{r.winnerVariant ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Δ omsetning</dt>
                  <dd className="tabular-nums">{r.deltaRevenue != null ? r.deltaRevenue.toFixed(2) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Δ konvertering</dt>
                  <dd className="tabular-nums">{r.deltaConversion != null ? r.deltaConversion.toFixed(4) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Δ feil</dt>
                  <dd className="tabular-nums">{r.deltaErrors != null ? r.deltaErrors : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Status</dt>
                  <dd className="text-slate-600">{r.status}</dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
