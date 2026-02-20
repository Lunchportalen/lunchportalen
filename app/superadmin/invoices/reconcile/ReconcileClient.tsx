"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ReconcileStatus = "OK" | "AVVIK" | "NOT_EXPORTED";

type ReconcileRow = {
  company_id: string;
  company_name: string;
  rollup_qty: number;
  invoice_qty: number;
  delta: number;
  export_status: string;
  locked: boolean;
  reference: string | null;
  reasons: string[];
  reconcile_status: ReconcileStatus;
};

type ReconcileData = {
  month: string;
  quantitySource: "daily_company_rollup" | "orders";
  rows: ReconcileRow[];
  summary: {
    total: number;
    ok: number;
    avvik: number;
    notExported: number;
  };
};

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function fmtInt(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("nb-NO").format(Math.round(n));
}

function statusChip(status: ReconcileStatus) {
  const base = "inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1";
  if (status === "OK") return `${base} bg-white/60 text-[rgb(var(--lp-text))] ring-[rgb(var(--lp-border))]`;
  if (status === "NOT_EXPORTED") return `${base} bg-white/60 text-[rgb(var(--lp-text))] ring-[rgb(var(--lp-border))]`;
  return `${base} bg-black text-white ring-black`;
}

export default function ReconcileClient({ initialMonth }: { initialMonth: string }) {
  const [month, setMonth] = useState(initialMonth);
  const [filter, setFilter] = useState<"ALL" | ReconcileStatus>("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReconcileData | null>(null);

  async function load(targetMonth: string) {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/superadmin/invoices/reconcile?month=${encodeURIComponent(targetMonth)}`, {
      cache: "no-store",
    }).catch(() => null);

    if (!res) {
      setLoading(false);
      setError("Kunne ikke hente avstemming.");
      return;
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      setLoading(false);
      setError(safeStr(json?.message) || "Kunne ikke hente avstemming.");
      return;
    }

    setData((json?.data ?? null) as ReconcileData | null);
    setLoading(false);
  }

  useEffect(() => {
    load(initialMonth);
  }, [initialMonth]);

  const rows = useMemo(() => {
    const source = Array.isArray(data?.rows) ? data!.rows : [];
    if (filter === "ALL") return source;
    return source.filter((row) => row.reconcile_status === filter);
  }, [data, filter]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[rgb(var(--lp-text))]">Faktura avstemming</h1>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
            Kontroll av orders → rollup → invoice_lines → Tripletex eksport.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl bg-white/60 px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))]"
          />
          <button
            onClick={() => load(month)}
            className="rounded-xl bg-black px-4 py-2 text-sm text-white ring-1 ring-black hover:opacity-90"
          >
            Kjor avstemming
          </button>
          <Link
            href="/superadmin/invoices"
            className="rounded-xl bg-white/60 px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white"
          >
            Tilbake
          </Link>
        </div>
      </div>

      <div className="mb-4 rounded-2xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-[rgb(var(--lp-muted))]">
            Kilde: <span className="font-semibold text-[rgb(var(--lp-text))]">{data?.quantitySource ?? "-"}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter("ALL")}
              className="rounded-xl bg-white/60 px-3 py-2 text-xs ring-1 ring-[rgb(var(--lp-border))] hover:bg-white"
            >
              Alle ({fmtInt(data?.summary?.total ?? 0)})
            </button>
            <button
              onClick={() => setFilter("OK")}
              className="rounded-xl bg-white/60 px-3 py-2 text-xs ring-1 ring-[rgb(var(--lp-border))] hover:bg-white"
            >
              OK ({fmtInt(data?.summary?.ok ?? 0)})
            </button>
            <button
              onClick={() => setFilter("AVVIK")}
              className="rounded-xl bg-white/60 px-3 py-2 text-xs ring-1 ring-[rgb(var(--lp-border))] hover:bg-white"
            >
              Avvik ({fmtInt(data?.summary?.avvik ?? 0)})
            </button>
            <button
              onClick={() => setFilter("NOT_EXPORTED")}
              className="rounded-xl bg-white/60 px-3 py-2 text-xs ring-1 ring-[rgb(var(--lp-border))] hover:bg-white"
            >
              Ikke eksportert ({fmtInt(data?.summary?.notExported ?? 0)})
            </button>
          </div>
        </div>

        {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
      </div>

      <section className="space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-4 text-sm text-[rgb(var(--lp-muted))] ring-1 ring-[rgb(var(--lp-border))]">
            Laster...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-4 text-sm text-[rgb(var(--lp-muted))] ring-1 ring-[rgb(var(--lp-border))]">
            Ingen rader for valgt filter.
          </div>
        ) : (
          rows.map((row) => (
            <article key={row.company_id} className="rounded-2xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[rgb(var(--lp-text))]">{row.company_name}</div>
                  <div className="break-all text-xs text-[rgb(var(--lp-muted))]">{row.company_id}</div>
                </div>
                <span className={statusChip(row.reconcile_status)}>{row.reconcile_status}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-[rgb(var(--lp-muted))]">
                <div>Rollup: {fmtInt(row.rollup_qty)}</div>
                <div>Invoice: {fmtInt(row.invoice_qty)}</div>
                <div>Delta: {fmtInt(row.delta)}</div>
                <div>Export: {row.export_status}</div>
                <div>Locked: {row.locked ? "Ja" : "Nei"}</div>
                <div className="break-all">Ref: {row.reference ?? "-"}</div>
              </div>

              <div className="mt-2 break-words text-xs text-[rgb(var(--lp-muted))]">
                Reason: {row.reasons.length ? row.reasons.join(", ") : "-"}
              </div>
            </article>
          ))
        )}
      </section>

      <div className="hidden rounded-2xl bg-[rgb(var(--lp-surface))] ring-1 ring-[rgb(var(--lp-border))] md:block">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="text-xs text-[rgb(var(--lp-muted))]">
            <tr className="[&>th]:px-4 [&>th]:py-3">
              <th className="w-[22%]">Firma</th>
              <th className="w-[9%]">Status</th>
              <th className="w-[8%]">Rollup</th>
              <th className="w-[8%]">Invoice</th>
              <th className="w-[8%]">Delta</th>
              <th className="w-[10%]">Export</th>
              <th className="w-[7%]">Locked</th>
              <th className="w-[14%]">Reference</th>
              <th className="w-[22%]">Reasons</th>
            </tr>
          </thead>
          <tbody className="text-[rgb(var(--lp-text))]">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-[rgb(var(--lp-muted))]">
                  Laster...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-[rgb(var(--lp-muted))]">
                  Ingen rader for valgt filter.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.company_id} className="border-t border-[rgb(var(--lp-border))] align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.company_name}</div>
                    <div className="break-all text-xs text-[rgb(var(--lp-muted))]">{row.company_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusChip(row.reconcile_status)}>{row.reconcile_status}</span>
                  </td>
                  <td className="px-4 py-3">{fmtInt(row.rollup_qty)}</td>
                  <td className="px-4 py-3">{fmtInt(row.invoice_qty)}</td>
                  <td className="px-4 py-3">{fmtInt(row.delta)}</td>
                  <td className="px-4 py-3">{row.export_status}</td>
                  <td className="px-4 py-3">{row.locked ? "Ja" : "Nei"}</td>
                  <td className="break-all px-4 py-3 text-xs text-[rgb(var(--lp-muted))]">{row.reference ?? "-"}</td>
                  <td className="break-words px-4 py-3 text-xs text-[rgb(var(--lp-muted))]">
                    {row.reasons.length ? row.reasons.join(", ") : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
