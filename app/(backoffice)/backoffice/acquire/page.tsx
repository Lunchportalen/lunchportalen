"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type AcquireLists = {
  targets: Array<{ name: string; size: string; value: number }>;
  buyers: Array<{ name: string; interest: string }>;
};

type ApiOk<T> = { ok: true; rid: string; data: T };
type ApiErr = { ok: false; rid: string; message: string };

export default function AcquireModePage() {
  const [lists, setLists] = useState<AcquireLists | null>(null);
  const [strategy, setStrategy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/acquire", { credentials: "include" });
      const j = (await r.json()) as ApiOk<AcquireLists> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kunne ikke laste Acquire-modus.";
        setError(msg);
        setLists(null);
        return;
      }
      setLists(j.data);
    } catch {
      setError("Nettverksfeil.");
      setLists(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const runStrategy = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/acquire/strategy", {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json()) as ApiOk<{ strategy: string }> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Strategi feilet.";
        setError(msg);
        return;
      }
      setStrategy(j.data.strategy);
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
      </div>

      <div>
        <h1 className="font-heading text-xl font-semibold text-slate-900">Acquire-modus</h1>
        <p className="mt-1 text-sm text-slate-600">
          Illustrasjonslister (ikke markedsdata). AI-strategi kjøres kun når du trykker knappen — ingen auto-kjøp eller
          eksterne handlinger.
        </p>
      </div>

      {loading ? <p className="text-sm text-slate-600">Laster…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && lists ? (
        <div className="space-y-6 text-left">
          <section>
            <h2 className="text-sm font-semibold text-slate-900">Mål (illustrasjon)</h2>
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-3 font-mono text-xs text-slate-800">
              {JSON.stringify(lists.targets, null, 2)}
            </pre>
          </section>
          <section>
            <h2 className="text-sm font-semibold text-slate-900">Kjøpere (illustrasjon)</h2>
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-3 font-mono text-xs text-slate-800">
              {JSON.stringify(lists.buyers, null, 2)}
            </pre>
          </section>
          <div>
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-800 transition-all duration-300 hover:scale-[1.02] hover:border-pink-400/55 disabled:opacity-50"
              onClick={() => void runStrategy()}
              disabled={busy}
            >
              Generer M&A-strategi (utkast)
            </button>
          </div>
          {strategy ? (
            <section>
              <h2 className="text-sm font-semibold text-slate-900">Strategi (utkast)</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{strategy}</p>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
