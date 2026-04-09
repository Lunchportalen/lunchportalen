"use client";

import { useCallback, useEffect, useState } from "react";

type CtoOk = { ok: true; rid: string; data: any };
type CtoErr = { ok: false; rid?: string; error: string; message?: string; status?: number };
type CtoResp = CtoOk | CtoErr;

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatNok(v: number) {
  return `${Math.round(v).toLocaleString("no-NO")} kr`;
}

export default function CtoClient() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rid, setRid] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setRid(null);
    try {
      const res = await fetch("/api/cto/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as CtoResp | null;
      if (!res.ok || !json || (json as CtoErr).ok === false) {
        const e = json as CtoErr | null;
        setErr(e?.message || e?.error || `HTTP ${res.status}`);
        setRid(e?.rid ?? null);
        setData(null);
        return;
      }
      const ok = json as CtoOk;
      setRid(ok.rid ?? null);
      setData(ok.data ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kunne ikke kjøre CTO.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const model = data?.model ?? {};
  const issues = Array.isArray(data?.issues) ? data.issues : [];
  const roadmap = Array.isArray(data?.roadmap) ? data.roadmap : [];
  const audit = data?.audit ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => load().catch(() => {})}
          disabled={loading}
          className="rounded-full border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-bg))] px-4 py-2 text-sm font-medium text-[rgb(var(--lp-muted))] hover:bg-white disabled:opacity-50"
        >
          {loading ? "Oppdaterer …" : "Kjør analyse på nytt"}
        </button>
        {rid ? (
          <span className="text-xs text-[rgb(var(--lp-muted))]">
            RID: <span className="font-mono">{rid}</span>
          </span>
        ) : null}
        {audit.written === false ? (
          <span className="text-xs text-amber-800">Audit-logg ble ikke skrevet (sjekk drift).</span>
        ) : null}
      </div>

      {err ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Omsetning (ordre)</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{formatNok(num(model.revenue))}</div>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Konvertering</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {num(model.leads) > 0 ? `${(num(model.conversion) * 100).toFixed(2)} %` : "—"}
          </div>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Ordre {model.orders ?? 0} / leads {model.leads ?? 0}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">AI-aktivitet (rader)</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{model.activityLogRows ?? 0}</div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <h2 className="text-lg font-semibold">Flagg</h2>
        {issues.length === 0 ? (
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Ingen regelbaserte avvik mot nåværende terskler.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {issues.map((i: { message?: string; impact?: string; explain?: string; type?: string }, idx: number) => (
              <li key={`${i.type ?? "issue"}-${idx}`} className="rounded-xl border border-[rgb(var(--lp-border))] p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{i.message}</span>
                  <span className="text-xs uppercase text-[rgb(var(--lp-muted))]">{i.impact}</span>
                </div>
                {i.explain ? <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">{i.explain}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-white p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <h2 className="text-lg font-semibold">Prioritert roadmap</h2>
        {roadmap.length === 0 ? (
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Ingen tiltak i kø (ingen flagg).</p>
        ) : (
          <ol className="mt-4 list-decimal space-y-4 pl-5">
            {roadmap.map(
              (r: { priority?: number; action?: string; expectedImpact?: number; explain?: string }, idx: number) => (
                <li key={`${r.action ?? "step"}-${idx}`} className="marker:font-semibold">
                  <div className="font-medium">{r.action}</div>
                  <div className="text-sm text-[rgb(var(--lp-muted))]">
                    Forventet relativ effekt (sortering): {num(r.expectedImpact).toFixed(2)}
                  </div>
                  {r.explain ? <p className="mt-1 text-sm">{r.explain}</p> : null}
                </li>
              )
            )}
          </ol>
        )}
      </section>
    </div>
  );
}
