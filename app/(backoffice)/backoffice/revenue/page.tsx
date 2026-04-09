"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type RevenuePayload = {
  attribution: Record<string, number>;
  forecast: { current: number; projected: number };
};

type ApiOk = { ok: true; rid: string; data: RevenuePayload };
type ApiErr = { ok: false; rid: string; message: string };

export default function RevenueEnginePage() {
  const [data, setData] = useState<RevenuePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/revenue", { credentials: "include" });
      const j = (await r.json()) as ApiOk | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kunne ikke laste revenue-motor.";
        setError(msg);
        setData(null);
        return;
      }
      setData(j.data);
    } catch {
      setError("Nettverksfeil.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 text-center sm:text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/backoffice/ai" className="text-sm text-slate-600 hover:text-slate-900">
          ← AI Command Center
        </Link>
      </div>

      <div>
        <h1 className="font-heading text-xl font-semibold text-slate-900">Revenue-motor</h1>
        <p className="mt-1 text-sm text-slate-600">
          Attribusjon fra sporbar AI-konvertering og enkel prognose (×1,2). Kun lesing — ingen automatisk fakturering.
        </p>
      </div>

      {loading ? <p className="text-sm text-slate-600">Laster…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && data ? (
        <div className="space-y-4 text-left">
          <ul className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm">
            <li>
              Attribuert omsetning (sum): <span className="font-medium tabular-nums">{data.forecast.current}</span>
            </li>
            <li>
              Enkel prognose: <span className="font-medium tabular-nums">{data.forecast.projected}</span>
            </li>
            <li className="text-xs text-slate-500">Modell: deterministisk vekstfaktor 1,2 på nåværende attribuert total.</li>
          </ul>

          <div>
            <h2 className="text-sm font-semibold text-slate-900">Per kilde (prompt-nøkkel)</h2>
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-3 font-mono text-xs text-slate-800">
              {JSON.stringify(data.attribution, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
