"use client";

import { useCallback, useEffect, useState } from "react";

type Insights = {
  pageId: string;
  pageViews7d: number;
  ctaClicks7d: number;
  conversionScore: number;
  revenueImpactProxy: number;
  suggestions: string[];
};

type ApiOk = { ok: true; rid: string; data: { insights: Insights | null; message?: string } };
type ApiErr = { ok: false; rid: string; message?: string };
type ApiEnvelope = ApiOk | ApiErr;

function isApiErr(x: ApiEnvelope): x is ApiErr {
  return x.ok === false;
}

export function EditorEnterpriseInsightsPanel({ pageId }: { pageId: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Insights | null>(null);

  const load = useCallback(async () => {
    if (!pageId) {
      setData(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/backoffice/enterprise/page-insights?pageId=${encodeURIComponent(pageId)}`, {
        credentials: "include",
      });
      const j = (await res.json()) as ApiEnvelope;
      if (isApiErr(j)) {
        setError(j.message ?? "Feilet");
        setData(null);
        return;
      }
      setData(j.data.insights);
    } catch {
      setError("Nettverksfeil");
      setData(null);
    } finally {
      setBusy(false);
    }
  }, [pageId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!pageId) return null;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-amber-50/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Inntekt / konvertering (side)</h3>
        <button
          type="button"
          className="text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
          onClick={() => void load()}
          disabled={busy}
        >
          Oppdater
        </button>
      </div>
      <p className="mt-1 text-[11px] text-slate-600">7 dager, prod — proxy, ikke regnskap.</p>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {busy && !data ? <p className="mt-2 text-xs text-slate-500">Laster…</p> : null}
      {data ? (
        <ul className="mt-2 space-y-1 text-xs text-slate-800">
          <li>Visninger (7d): {data.pageViews7d}</li>
          <li>CTA-klikk (7d): {data.ctaClicks7d}</li>
          <li>Konverteringsscore (proxy): {(data.conversionScore * 100).toFixed(0)}%</li>
          <li>Inntektsimpact (proxy): {(data.revenueImpactProxy * 100).toFixed(0)}%</li>
          {data.suggestions.map((s, i) => (
            <li key={i} className="text-slate-600">
              → {s}
            </li>
          ))}
        </ul>
      ) : !busy && !error ? (
        <p className="mt-2 text-xs text-slate-500">Ingen analytics-data for denne siden.</p>
      ) : null}
    </div>
  );
}
