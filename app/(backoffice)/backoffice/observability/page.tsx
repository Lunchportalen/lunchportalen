"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type LatencyAgg = { avg: number; samples: number; routeCount: number };
type LatencyRow = { avg: number; samples: number };

type ObservabilityPayload = {
  routes: { api: LatencyAgg };
  byRoute: Record<string, LatencyRow>;
};

type ApiOk = { ok: true; rid: string; data: ObservabilityPayload };
type ApiErr = { ok: false; rid: string; message: string };

export default function ObservabilityPage() {
  const [data, setData] = useState<ObservabilityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/observability", { credentials: "include" });
      const j = (await r.json()) as ApiOk | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kunne ikke laste observabilitet.";
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

  const apiAvg = data?.routes.api.avg ?? 0;
  const apiSamples = data?.routes.api.samples ?? 0;
  const routeKeys = data ? Object.keys(data.byRoute).sort() : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 text-center sm:text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/backoffice/ops" className="text-sm text-slate-600 hover:text-slate-900">
          ← Enterprise Ops
        </Link>
      </div>

      <div>
        <h1 className="font-heading text-xl font-semibold text-slate-900">Observabilitet</h1>
        <p className="mt-1 text-sm text-slate-600">
          Latensaggregering fra minne (per instans). Superadmin — ikke full APM, men rask innsikt.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-pink-500 px-4 py-2 text-sm font-medium text-pink-600 shadow-sm hover:bg-pink-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500 min-h-[44px] min-w-[44px]"
        >
          Oppdater
        </button>
      </div>

      {loading ? <p className="text-sm text-slate-600">Laster…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && data ? (
        <div className="space-y-4">
          <ul className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm">
            <li>
              Snittlatens /api-prefix:{" "}
              <span className="font-medium tabular-nums">{apiAvg.toFixed(1)} ms</span>
            </li>
            <li>
              Målinger (aggregat): <span className="font-medium tabular-nums">{apiSamples}</span>
            </li>
            <li>
              Ruter med data: <span className="font-medium tabular-nums">{data.routes.api.routeCount}</span>
            </li>
          </ul>

          {routeKeys.length ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-left text-sm text-slate-800 shadow-sm">
              <p className="mb-2 font-medium text-slate-900">Per rute</p>
              <ul className="space-y-1">
                {routeKeys.map((k) => (
                  <li key={k} className="tabular-nums">
                    <span className="break-all">{k}</span>: {data.byRoute[k]?.avg.toFixed(1) ?? "0"} ms (
                    {data.byRoute[k]?.samples ?? 0} prøver)
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-600">Ingen rutedata ennå — kall instrumenterte API-er først.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
