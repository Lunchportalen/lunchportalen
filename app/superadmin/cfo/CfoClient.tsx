// app/superadmin/cfo/CfoClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";
import { formatDateNO } from "@/lib/date/oslo";

type SummaryOk = { ok: true; rid: string; data: any };
type SummaryErr = { ok: false; rid?: string; error: string; message?: string; status?: number };
type SummaryResp = SummaryOk | SummaryErr;

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatNok(v: number | null) {
  if (v === null || v === undefined) return "n/a";
  return `${Math.round(v).toLocaleString("no-NO")} kr`;
}

export default function CfoClient() {
  const today = osloTodayISODate();
  const defaultFrom = addDaysISO(today, -30);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(today);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rid, setRid] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    setRid(null);

    try {
      const qs = new URLSearchParams({ from, to });
      const res = await fetch(`/api/superadmin/cfo/summary?${qs.toString()}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as SummaryResp | null;

      if (!res.ok || !json || (json as any).ok !== true) {
        const e = json as SummaryErr | null;
        setErr(e?.message || e?.error || `HTTP ${res.status}`);
        setRid(e?.rid ?? null);
        setData(null);
        return;
      }

      const ok = json as SummaryOk;
      setRid(ok.rid ?? null);
      setData(ok.data ?? null);
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke hente CFO-sammendrag.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const warnings = useMemo(() => {
    const w = Array.isArray(data?.warnings) ? data.warnings : [];
    return w.map((x: any) => safeStr(x)).filter(Boolean);
  }, [data]);

  const topCompanies = Array.isArray(data?.top_companies) ? data.top_companies : [];
  const volumeByDay = Array.isArray(data?.volume_by_day) ? data.volume_by_day : [];
  const volumeByWeek = Array.isArray(data?.volume_by_week) ? data.volume_by_week : [];

  const totals = data?.totals ?? {};
  const stability = data?.stability ?? {};
  const cancellations = data?.cancellations ?? {};
  const companies = data?.companies ?? {};
  const risk = data?.risk_indicators ?? { level: "LOW", reasons: [] };

  return (
    <div className="space-y-6">
      <form
        className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))] md:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          load().catch(() => {});
        }}
      >
        <label className="flex flex-col gap-1 text-xs font-semibold text-[rgb(var(--lp-muted))]">
          Fra (YYYY-MM-DD)
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-xl border border-[rgb(var(--lp-border))] px-3 py-2 text-sm text-[rgb(var(--lp-text))]"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[rgb(var(--lp-muted))]">
          Til (YYYY-MM-DD)
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-xl border border-[rgb(var(--lp-border))] px-3 py-2 text-sm text-[rgb(var(--lp-text))]"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="lp-motion-btn rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Oppdaterer..." : "Oppdater"}
        </button>
      </form>

      {err ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          {err}
          {rid ? <div className="mt-1 text-xs font-mono">RID: {rid}</div> : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs font-semibold text-[rgb(var(--lp-muted))]">TOTAL ORDRE</div>
          <div className="mt-2 text-2xl font-semibold">{num(totals.orders)}</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Periode: {formatDateNO(from)} - {formatDateNO(to)}
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs font-semibold text-[rgb(var(--lp-muted))]">OMSETNING (NOK)</div>
          <div className="mt-2 text-2xl font-semibold">{formatNok(totals.revenue_nok ?? null)}</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Mangler pris: {num(totals.revenue_missing?.missing)} / {num(totals.revenue_missing?.total)}
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs font-semibold text-[rgb(var(--lp-muted))]">STABILITET</div>
          <div className="mt-2 text-2xl font-semibold">
            {stability.stability_rate !== null && stability.stability_rate !== undefined
              ? `${Math.round(num(stability.stability_rate) * 100)}%`
              : "n/a"}
          </div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Levert: {num(stability.delivered)} | Avbestilt: {num(stability.cancelled)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs font-semibold text-[rgb(var(--lp-muted))]">AKTIVE FIRMA</div>
          <div className="mt-2 text-2xl font-semibold">{num(companies.active)}</div>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs font-semibold text-[rgb(var(--lp-muted))]">ARKIVERTE FIRMA</div>
          <div className="mt-2 text-2xl font-semibold">{num(companies.archived)}</div>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs font-semibold text-[rgb(var(--lp-muted))]">RISIKO</div>
          <div className="mt-2 text-2xl font-semibold">{safeStr(risk.level || "LOW")}</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            {Array.isArray(risk.reasons) && risk.reasons.length ? risk.reasons.join(", ") : "Ingen varsler"}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm font-semibold">Avbestillinger</div>
        <div className="mt-2 grid gap-2 text-xs text-[rgb(var(--lp-muted))] sm:grid-cols-2">
          <div>Før 08:00: {num(cancellations.before_0800)}</div>
          <div>Etter 08:00: {num(cancellations.after_0800)}</div>
          <div>Mangler tidspunkt: {num(cancellations.missing_timestamp)}</div>
          <div>Kilde: {safeStr(cancellations.source) || "-"}</div>
        </div>
      </div>

      {warnings.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="text-sm font-semibold">Advarsler</div>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {warnings.map((w: string, idx: number) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm font-semibold">Top 10 firma (volum)</div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
              <tr>
                <th className="py-2 pr-3">Firma</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Ordre</th>
                <th className="py-2 pr-3">Avbestilt</th>
                <th className="py-2 pr-3">Omsetning</th>
              </tr>
            </thead>
            <tbody>
              {topCompanies.length ? (
                topCompanies.map((c: any) => (
                  <tr key={c.company_id} className="border-t border-[rgb(var(--lp-border))]">
                    <td className="py-2 pr-3">
                      <div className="font-semibold">{c.company_name || c.company_id}</div>
                      <div className="text-xs text-[rgb(var(--lp-muted))]">{c.orgnr || "-"}</div>
                    </td>
                    <td className="py-2 pr-3 text-xs">{c.status || "-"}</td>
                    <td className="py-2 pr-3">{num(c.orders)}</td>
                    <td className="py-2 pr-3">{num(c.cancelled)}</td>
                    <td className="py-2 pr-3">{formatNok(c.revenue_sum ?? null)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 text-sm text-[rgb(var(--lp-muted))]">Ingen data i perioden.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">Volum per dag</div>
          <div className="mt-2 space-y-2 text-xs text-[rgb(var(--lp-muted))]">
            {volumeByDay.length ? (
              volumeByDay.slice(-14).map((d: any) => (
                <div key={d.date} className="flex items-center justify-between">
                  <span>{d.date}</span>
                  <span>{num(d.orders)} ordre</span>
                </div>
              ))
            ) : (
              <div>Ingen data</div>
            )}
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">Volum per uke</div>
          <div className="mt-2 space-y-2 text-xs text-[rgb(var(--lp-muted))]">
            {volumeByWeek.length ? (
              volumeByWeek.slice(-12).map((w: any) => (
                <div key={w.week_start} className="flex items-center justify-between">
                  <span>{w.week_start}</span>
                  <span>{num(w.orders)} ordre</span>
                </div>
              ))
            ) : (
              <div>Ingen data</div>
            )}
          </div>
        </div>
      </div>

      {rid ? <div className="text-xs font-mono text-[rgb(var(--lp-muted))]">RID: {rid}</div> : null}
    </div>
  );
}
