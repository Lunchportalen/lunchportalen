"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type AutonomyRecommendation = {
  title: string;
  action: string;
  priority: string;
  decisionType: string;
  reason: string;
};

type ApiOk<T> = { ok: true; rid: string; data: T };
type ApiErr = { ok: false; rid: string; message: string };

export default function AutonomyPage() {
  const [items, setItems] = useState<AutonomyRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/backoffice/autonomy/recommendations", { credentials: "include" });
      const j = (await r.json()) as ApiOk<{ recommendations: AutonomyRecommendation[] }> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg = (j as ApiErr).message && typeof (j as ApiErr).message === "string" ? (j as ApiErr).message : "Kunne ikke laste anbefalinger.";
        setError(msg);
        setItems([]);
        return;
      }
      setItems(Array.isArray(j.data.recommendations) ? j.data.recommendations : []);
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
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/backoffice/ai" className="text-sm text-slate-600 hover:text-slate-900">
          ← AI Command Center
        </Link>
        <Link href="/backoffice/autonomy/optimize" className="text-sm text-slate-600 hover:text-slate-900">
          AI Optimization →
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">AI Autonomy</h1>
        <p className="mt-1 text-sm text-slate-600">
          Anbefalinger fra signaler i <code className="font-mono text-xs">ai_activity_log</code>. Ingen auto-kjøring — godkjenning skjer utenfor denne visningen.
        </p>
      </div>

      {loading ? <p className="text-sm text-slate-600">Laster…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-slate-600">Ingen anbefalinger akkurat nå (eller utilstrekkelige signaler).</p>
      ) : null}

      <ul className="space-y-4">
        {items.map((item, i) => (
          <li key={`${item.decisionType}-${i}`} className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
            <p className="mt-2 text-xs text-slate-500">
              Prioritet: <span className="font-medium text-slate-700">{item.priority}</span> · handling:{" "}
              <code className="font-mono">{item.action}</code>
            </p>
            <button
              type="button"
              disabled
              className="mt-3 cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400"
              title="Krever manuell godkjenning i operativ prosess — ikke auto-utført her"
            >
              Godkjenn (krever manuell prosess)
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
