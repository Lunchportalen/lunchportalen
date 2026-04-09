"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ExitPayload = {
  kpi: { revenue: number; arr: number; ltv: number; cac: number };
  valuation: { value: number; multiple: number };
};

type ApiOk = { ok: true; rid: string; data: ExitPayload };
type ApiErr = { ok: false; rid: string; message: string };

export default function ExitMetricsPage() {
  const [data, setData] = useState<ExitPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/exit", { credentials: "include" });
      const j = (await r.json()) as ApiOk | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kunne ikke laste exit-metrics.";
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
        <h1 className="font-heading text-xl font-semibold text-slate-900">Exit-metrics</h1>
        <p className="mt-1 text-sm text-slate-600">
          Proxy-KPI fra attribuert omsetning (ikke full regnskaps-ARR/LTV/CAC). Verdivurdering er illustrativ (multiple ×
          ARR-proxy).
        </p>
      </div>

      {loading ? <p className="text-sm text-slate-600">Laster…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && data ? (
        <div className="space-y-4">
          <ul className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm">
            <li>
              Omsetning (proxy): <span className="font-medium tabular-nums">{data.kpi.revenue}</span>
            </li>
            <li>
              ARR (proxy): <span className="font-medium tabular-nums">{data.kpi.arr}</span>
            </li>
            <li>
              LTV (proxy): <span className="font-medium tabular-nums">{data.kpi.ltv}</span>
            </li>
            <li>
              CAC (proxy): <span className="font-medium tabular-nums">{data.kpi.cac}</span>
            </li>
          </ul>
          <p className="text-2xl font-bold text-slate-900">
            Verdivurdering (illustrativ):{" "}
            <span className="tabular-nums">{data.valuation.value}</span>
            <span className="ml-2 text-base font-normal text-slate-600">
              (multiple {data.valuation.multiple}×)
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
