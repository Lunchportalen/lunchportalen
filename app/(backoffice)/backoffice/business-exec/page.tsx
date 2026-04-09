"use client";

import { useCallback, useState } from "react";

type ApiOk<T> = { ok: true; rid: string; data: T };
type ApiErr = { ok: false; rid: string; message: string };

export default function BusinessExecPage() {
  const [biz, setBiz] = useState<unknown>(null);
  const [scale, setScale] = useState<unknown>(null);
  const [exitSell, setExitSell] = useState<unknown>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runBusiness = useCallback(async () => {
    setLoading("business");
    setError(null);
    try {
      const r = await fetch("/api/business/run", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: 0 }),
      });
      const j = (await r.json()) as ApiOk<unknown> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        setError(
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Business-kjøring feilet.",
        );
        setBiz(null);
        return;
      }
      setBiz(j.data);
    } catch {
      setError("Nettverksfeil.");
      setBiz(null);
    } finally {
      setLoading(null);
    }
  }, []);

  const runScale = useCallback(async () => {
    setLoading("scale");
    setError(null);
    try {
      const r = await fetch("/api/sales/scale?n=8&outreach=5", { credentials: "include" });
      const j = (await r.json()) as ApiOk<unknown> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        setError(
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Salgs-skala feilet (krever PRODUCTION_MODE).",
        );
        setScale(null);
        return;
      }
      setScale(j.data);
    } catch {
      setError("Nettverksfeil.");
      setScale(null);
    } finally {
      setLoading(null);
    }
  }, []);

  const runExit = useCallback(async () => {
    setLoading("exit");
    setError(null);
    try {
      const r = await fetch("/api/exit/sell", { credentials: "include" });
      const j = (await r.json()) as ApiOk<unknown> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        setError(
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Exit-salg feilet.",
        );
        setExitSell(null);
        return;
      }
      setExitSell(j.data);
    } catch {
      setError("Nettverksfeil.");
      setExitSell(null);
    } finally {
      setLoading(null);
    }
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6 text-center sm:text-left">
      <div>
        <h1 className="font-heading text-xl font-semibold text-slate-900">Execute business</h1>
        <p className="mt-1 text-sm text-slate-600">
          Superadmin-verktøy. Inntekt krever eksplisitt godkjenning i API (approveRevenue) og PRODUCTION_MODE. Avslutning av
          avtale krever alltid menneskelig godkjenning.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-heading text-lg font-medium text-slate-900">Business pipeline</h2>
        <p className="text-sm text-slate-600">Kjør kundeflyt (uten automatisk inntekt).</p>
        <button
          type="button"
          onClick={() => void runBusiness()}
          disabled={loading !== null}
          className="rounded-full border border-pink-500 px-4 py-2 text-sm font-medium text-pink-600 shadow-sm hover:bg-pink-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500 min-h-[44px] min-w-[44px] disabled:opacity-50"
        >
          {loading === "business" ? "Kjører…" : "Kjør pipeline"}
        </button>
        {biz ? (
          <pre className="max-h-[240px] overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-3 text-left text-xs">
            {JSON.stringify(biz, null, 2)}
          </pre>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-heading text-lg font-medium text-slate-900">Sales scale</h2>
        <p className="text-sm text-slate-600">Deterministiske leads + outreach (krever PRODUCTION_MODE).</p>
        <button
          type="button"
          onClick={() => void runScale()}
          disabled={loading !== null}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 min-h-[44px] min-w-[44px] disabled:opacity-50"
        >
          {loading === "scale" ? "Kjører…" : "Generer leads + outreach"}
        </button>
        {scale ? (
          <pre className="max-h-[320px] overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-3 text-left text-xs">
            {JSON.stringify(scale, null, 2)}
          </pre>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-heading text-lg font-medium text-slate-900">Sell company</h2>
        <p className="text-sm text-slate-600">M&A-utkast fra KPI-proxy + kjøperutkast (ikke bindende).</p>
        <button
          type="button"
          onClick={() => void runExit()}
          disabled={loading !== null}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 min-h-[44px] min-w-[44px] disabled:opacity-50"
        >
          {loading === "exit" ? "Kjører…" : "Kjør exit"}
        </button>
        {exitSell ? (
          <pre className="max-h-[320px] overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-3 text-left text-xs">
            {JSON.stringify(exitSell, null, 2)}
          </pre>
        ) : null}
      </section>
    </div>
  );
}
