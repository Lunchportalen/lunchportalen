// app/superadmin/companies/[companyId]/InvoiceBasisPanel.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ApiErr = { ok: false; rid?: string; error: string; message?: string; status?: number; detail?: any };

type InvoiceDay = {
  date: string;
  delivered_count: number;
  sum: number | null;
};

type InvoiceWeek = {
  week_start: string;
  from: string;
  to: string;
  delivered_count: number;
  sum: number | null;
};

type InvoiceOk = {
  ok: true;
  rid: string;
  data: {
    companyId: string;
    from: string;
    to: string;
    delivered_count: number;
    sum: number | null;
    currency: string | null;
    warning: string | null;
    by_day: InvoiceDay[];
    by_week: InvoiceWeek[];
  };
};

function isoTodayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readJsonSafe(t: string) {
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function csvEscape(v: any) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, "\"\"")}"`;
  return s;
}

function buildCsv(data: InvoiceOk["data"]) {
  const lines: string[] = [];

  lines.push("Per dag");
  lines.push("date,delivered_count,sum,currency");
  for (const d of data.by_day ?? []) {
    lines.push(
      [
        csvEscape(d.date),
        csvEscape(d.delivered_count),
        csvEscape(d.sum ?? ""),
        csvEscape(data.currency ?? ""),
      ].join(",")
    );
  }

  lines.push("");
  lines.push("Per uke");
  lines.push("week_start,from,to,delivered_count,sum,currency");
  for (const w of data.by_week ?? []) {
    lines.push(
      [
        csvEscape(w.week_start),
        csvEscape(w.from),
        csvEscape(w.to),
        csvEscape(w.delivered_count),
        csvEscape(w.sum ?? ""),
        csvEscape(data.currency ?? ""),
      ].join(",")
    );
  }

  return lines.join("\n");
}

export default function InvoiceBasisPanel({ companyId }: { companyId: string }) {
  const [fromDate, setFromDate] = useState<string>(isoDaysAgo(90));
  const [toDate, setToDate] = useState<string>(isoTodayLocal());

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<InvoiceOk["data"] | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (fromDate) p.set("from", fromDate);
    if (toDate) p.set("to", toDate);
    return p.toString();
  }, [fromDate, toDate]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`/api/superadmin/companies/${encodeURIComponent(companyId)}/invoice-basis?${qs}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const body = readJsonSafe(await res.text());
      if (!res.ok || !body?.ok) {
        const e = (body as ApiErr) ?? { ok: false, error: "HTTP_ERROR", message: `HTTP ${res.status}` };
        setErr(e.message || e.error || "Kunne ikke hente fakturagrunnlag.");
        setData(null);
        return;
      }
      setData((body as InvoiceOk).data ?? null);
    } catch (e: any) {
      setErr(e?.message || "Kunne ikke hente fakturagrunnlag.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, qs]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-[rgb(var(--lp-muted))]">Fra</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 rounded-2xl border bg-white px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-[rgb(var(--lp-muted))]">Til</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 rounded-2xl border bg-white px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={load}
          className="rounded-full border bg-white px-4 py-2 text-xs font-semibold hover:bg-neutral-50 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Oppdaterer…" : "Oppdater"}
        </button>
        <button
          onClick={() => {
            if (!data) return;
            const csv = buildCsv(data);
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `fakturagrunnlag_${companyId}_${data.from}_${data.to}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="rounded-full border bg-white px-4 py-2 text-xs font-semibold hover:bg-neutral-50 disabled:opacity-50"
          disabled={!data || loading}
        >
          Last ned CSV
        </button>
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div>
      ) : null}

      {!err && loading ? <div className="text-sm text-[rgb(var(--lp-muted))]">Laster…</div> : null}

      {!err && !loading && data ? (
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Antall leverte ordre</div>
              <div className="mt-1 text-lg font-semibold">{data.delivered_count}</div>
            </div>
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Sum</div>
              <div className="mt-1 text-lg font-semibold">
                {Number.isFinite(Number(data.sum)) ? `${Number(data.sum)} ${data.currency ?? ""}` : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Periode</div>
              <div className="mt-1 text-sm font-semibold">
                {data.from} – {data.to}
              </div>
            </div>
          </div>

          {data.warning ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {data.warning}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-white/70 p-4">
              <div className="text-xs font-semibold">Per dag</div>
              <div className="mt-2 max-h-64 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[rgb(var(--lp-muted))]">
                    <tr className="border-b border-[rgb(var(--lp-border))]">
                      <th className="px-2 py-2">Dato</th>
                      <th className="px-2 py-2">Leveranser</th>
                      <th className="px-2 py-2">Sum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.by_day ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-2 py-3 text-[rgb(var(--lp-muted))]">
                          Ingen data.
                        </td>
                      </tr>
                    ) : (
                      (data.by_day ?? []).map((d) => (
                        <tr key={d.date} className="border-b border-[rgb(var(--lp-border))] last:border-b-0">
                          <td className="px-2 py-2">{d.date}</td>
                          <td className="px-2 py-2">{d.delivered_count}</td>
                          <td className="px-2 py-2">
                            {Number.isFinite(Number(d.sum)) ? `${Number(d.sum)} ${data.currency ?? ""}` : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border bg-white/70 p-4">
              <div className="text-xs font-semibold">Per uke</div>
              <div className="mt-2 max-h-64 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[rgb(var(--lp-muted))]">
                    <tr className="border-b border-[rgb(var(--lp-border))]">
                      <th className="px-2 py-2">Uke</th>
                      <th className="px-2 py-2">Leveranser</th>
                      <th className="px-2 py-2">Sum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.by_week ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-2 py-3 text-[rgb(var(--lp-muted))]">
                          Ingen data.
                        </td>
                      </tr>
                    ) : (
                      (data.by_week ?? []).map((w) => (
                        <tr key={w.week_start} className="border-b border-[rgb(var(--lp-border))] last:border-b-0">
                          <td className="px-2 py-2">{w.week_start}</td>
                          <td className="px-2 py-2">{w.delivered_count}</td>
                          <td className="px-2 py-2">
                            {Number.isFinite(Number(w.sum)) ? `${Number(w.sum)} ${data.currency ?? ""}` : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
