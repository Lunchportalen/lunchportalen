"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";

type ModePayload = { autoMode: boolean; source: string; hint: string };
type ApiOk<T> = { ok: true; rid: string; data: T };
type ApiErr = { ok: false; rid: string; message: string };

const DEFAULT_LEADS = `[
  { "company_size": 120, "pain": "kaos i bestilling", "role": "decision_maker" },
  { "company_size": 10, "pain": "", "role": "user" }
]`;

export default function AutomationControlPage() {
  const idSales = useId();
  const idRev = useId();
  const [mode, setMode] = useState<ModePayload | null>(null);
  const [leadsJson, setLeadsJson] = useState(DEFAULT_LEADS);
  const [recordRevenue, setRecordRevenue] = useState(false);
  const [salesOut, setSalesOut] = useState<string | null>(null);
  const [revOut, setRevOut] = useState<string | null>(null);
  const [loadingMode, setLoadingMode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMode = useCallback(async () => {
    setLoadingMode(true);
    setError(null);
    try {
      const r = await fetch("/api/automation/mode", { credentials: "include" });
      const j = (await r.json()) as ApiOk<ModePayload> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kunne ikke lese modus.";
        setError(msg);
        setMode(null);
        return;
      }
      setMode(j.data);
    } catch {
      setError("Nettverksfeil.");
      setMode(null);
    } finally {
      setLoadingMode(false);
    }
  }, []);

  useEffect(() => {
    void loadMode();
  }, [loadMode]);

  const runSales = async () => {
    setBusy(true);
    setError(null);
    setSalesOut(null);
    try {
      let leads: unknown;
      try {
        leads = JSON.parse(leadsJson) as unknown;
      } catch {
        setError("Ugyldig JSON i leads.");
        setBusy(false);
        return;
      }
      const idem = crypto.randomUUID();
      const r = await fetch("/api/sales/ai", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": idem,
        },
        body: JSON.stringify({ leads, recordRevenueSignals: recordRevenue }),
      });
      const j = (await r.json()) as ApiOk<{ results: unknown }> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Sales AI feilet.";
        setError(msg);
        return;
      }
      setSalesOut(JSON.stringify(j.data.results, null, 2));
    } catch {
      setError("Nettverksfeil.");
    } finally {
      setBusy(false);
    }
  };

  const loadRevenue = async () => {
    setBusy(true);
    setError(null);
    setRevOut(null);
    try {
      const r = await fetch("/api/revenue/live", { credentials: "include" });
      const j = (await r.json()) as ApiOk<{ attribution: Record<string, number>; total: number }> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kunne ikke hente revenue.";
        setError(msg);
        return;
      }
      setRevOut(JSON.stringify(j.data, null, 2));
    } catch {
      setError("Nettverksfeil.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 text-center sm:text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/backoffice/ai" className="text-sm text-slate-600 hover:text-slate-900">
          ← AI Command Center
        </Link>
        <Link href="/backoffice/execution" className="text-sm text-slate-600 hover:text-slate-900">
          Execution Control
        </Link>
      </div>

      <div>
        <h1 className="font-heading text-xl font-semibold text-slate-900">Automation Control</h1>
        <p className="mt-1 text-sm text-slate-600">
          Full auto er begrenset til policy (analyze/log/score) og krever AI_AUTO_MODE=true på server. Inntektssignaler
          krever eksplisitt avkryssing — ikke fakturert regnskap.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Auto-modus (server)</h2>
        {loadingMode ? <p className="mt-2 text-sm text-slate-600">Laster…</p> : null}
        {!loadingMode && mode ? (
          <ul className="mt-2 space-y-1 text-sm text-slate-800">
            <li>
              Status: <span className="font-medium">{mode.autoMode ? "PÅ" : "AV"}</span>
            </li>
            <li className="text-xs text-slate-500">{mode.source}</li>
            <li className="text-xs text-slate-500">{mode.hint}</li>
          </ul>
        ) : null}
        <button
          type="button"
          className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-800 transition-all duration-300 hover:scale-[1.02] hover:border-pink-400/55 disabled:opacity-50"
          onClick={() => void loadMode()}
          disabled={busy || loadingMode}
        >
          Oppdater status
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 id={idSales} className="text-sm font-semibold text-slate-900">
          Enterprise Sales AI
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Poengsetter leads og foreslår neste steg. Ingen e-post sendes herfra. Inntektssignal er valgfritt og merket som
          læring i sporingslaget.
        </p>
        <label className="mt-3 block text-left text-xs font-medium text-slate-700" htmlFor={`${idSales}-ta`}>
          Leads (JSON)
        </label>
        <textarea
          id={`${idSales}-ta`}
          className="mt-1 min-h-[120px] w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900"
          value={leadsJson}
          onChange={(e) => setLeadsJson(e.target.value)}
          disabled={busy}
        />
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={recordRevenue}
            onChange={(e) => setRecordRevenue(e.target.checked)}
            disabled={busy}
          />
          Registrer inntektssignal for book_meeting (valgfritt)
        </label>
        <button
          type="button"
          className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-800 transition-all duration-300 hover:scale-[1.02] hover:border-pink-400/55 disabled:opacity-50"
          onClick={() => void runSales()}
          disabled={busy}
        >
          Kjør Sales Engine
        </button>
        {salesOut ? (
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 text-left font-mono text-xs text-slate-800">
            {salesOut}
          </pre>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 id={idRev} className="text-sm font-semibold text-slate-900">
          Revenue (live)
        </h2>
        <p className="mt-1 text-xs text-slate-500">Attribuert omsetning fra sporingslag (kort cache).</p>
        <button
          type="button"
          className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-800 transition-all duration-300 hover:scale-[1.02] hover:border-pink-400/55 disabled:opacity-50"
          onClick={() => void loadRevenue()}
          disabled={busy}
        >
          Vis live revenue
        </button>
        {revOut ? (
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 text-left font-mono text-xs text-slate-800">
            {revOut}
          </pre>
        ) : null}
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
