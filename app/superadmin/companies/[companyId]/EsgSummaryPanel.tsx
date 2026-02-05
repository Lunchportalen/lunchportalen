// app/superadmin/companies/[companyId]/EsgSummaryPanel.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ApiErr = { ok: false; rid?: string; error: string; message?: string; status?: number; detail?: any };

type EsgOk = {
  ok: true;
  rid: string;
  data: {
    companyId: string;
    from: string;
    to: string;
    delivered_count: number;
    cancelled_in_time_count: number;
    saved_portions_estimate: number;
    comment: string;
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

export default function EsgSummaryPanel({ companyId }: { companyId: string }) {
  const [fromDate, setFromDate] = useState<string>(isoDaysAgo(90));
  const [toDate, setToDate] = useState<string>(isoTodayLocal());

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<EsgOk["data"] | null>(null);

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
      const res = await fetch(`/api/superadmin/companies/${encodeURIComponent(companyId)}/esg?${qs}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const body = readJsonSafe(await res.text());
      if (!res.ok || !body?.ok) {
        const e = (body as ApiErr) ?? { ok: false, error: "HTTP_ERROR", message: `HTTP ${res.status}` };
        setErr(e.message || e.error || "Kunne ikke hente ESG.");
        setData(null);
        return;
      }
      setData((body as EsgOk).data ?? null);
    } catch (e: any) {
      setErr(e?.message || "Kunne ikke hente ESG.");
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
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div>
      ) : null}

      {!err && loading ? <div className="text-sm text-[rgb(var(--lp-muted))]">Laster…</div> : null}

      {!err && !loading && data ? (
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Antall leveranser</div>
              <div className="mt-1 text-lg font-semibold">{data.delivered_count}</div>
            </div>
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Avbestillinger før 08:00</div>
              <div className="mt-1 text-lg font-semibold">{data.cancelled_in_time_count}</div>
            </div>
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Estimert spart porsjoner</div>
              <div className="mt-1 text-lg font-semibold">{data.saved_portions_estimate}</div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white/70 p-4 text-sm text-[rgb(var(--lp-muted))]">
            {data.comment}
          </div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">
            Periode: {data.from} – {data.to}
          </div>
        </div>
      ) : null}
    </div>
  );
}
