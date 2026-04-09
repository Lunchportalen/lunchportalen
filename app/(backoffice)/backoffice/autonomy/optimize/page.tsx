"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Suggestion = {
  key: string;
  type: string;
  current: string;
  proposed: string;
  reason: string;
  conversionRate: number;
  runs: number;
};

type ApiOk<T> = { ok: true; rid: string; data: T };
type ApiErr = { ok: false; rid: string; message: string };

export default function AutonomyOptimizePage() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/backoffice/autonomy/optimize", { credentials: "include" });
      const j = (await r.json()) as ApiOk<{ suggestions: Suggestion[] }> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg = (j as ApiErr).message && typeof (j as ApiErr).message === "string" ? (j as ApiErr).message : "Kunne ikke laste forslag.";
        setError(msg);
        setItems([]);
        return;
      }
      setItems(Array.isArray(j.data.suggestions) ? j.data.suggestions : []);
    } catch {
      setError("Nettverksfeil.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/backoffice/autonomy" className="text-sm text-slate-600 hover:text-slate-900">
          ← AI Autonomy
        </Link>
        <Link href="/backoffice/system/ai-prompts" className="text-sm text-slate-600 hover:text-slate-900">
          Prompt-register →
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">AI Optimization</h1>
        <p className="mt-1 text-sm text-slate-600">
          Forslag genereres fra ytelse + LLM. Ingenting lagres automatisk — kopier manuelt inn i{" "}
          <code className="font-mono text-xs">ai_config.features.prompt_registry</code> etter godkjenning.
        </p>
      </div>

      {loading ? <p className="text-sm text-slate-600">Genererer forslag (kan ta litt tid)…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-slate-600">Ingen forslag (god nok konvertering eller manglende signaler).</p>
      ) : null}

      <ul className="space-y-6">
        {items.map((item, i) => (
          <li key={`${item.key}-${i}`} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <h2 className="text-base font-semibold text-slate-900">
              {item.key}{" "}
              <span className="text-xs font-normal text-slate-500">
                (rate {item.conversionRate.toFixed(4)}, runs {item.runs})
              </span>
            </h2>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Nåværende</p>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-800">
                {item.current}
              </pre>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Foreslått</p>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-emerald-50/60 p-3 text-xs text-slate-800">
                {item.proposed}
              </pre>
            </div>

            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400"
              title="Implementeres manuelt i prompt-register — ingen auto-deploy"
            >
              Godkjenn (manuell implementering)
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
