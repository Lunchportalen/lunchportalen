"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type CompetitorsPayload = {
  competitors: Array<{ name: string; weakness: string }>;
};

type ApiOk<T> = { ok: true; rid: string; data: T };
type ApiErr = { ok: false; rid: string; message: string };

export default function MonopolyModePage() {
  const [competitors, setCompetitors] = useState<CompetitorsPayload["competitors"] | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCompetitors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/market/domination", { credentials: "include" });
      const j = (await r.json()) as ApiOk<CompetitorsPayload> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kunne ikke laste konkurrentliste.";
        setError(msg);
        setCompetitors(null);
        return;
      }
      setCompetitors(j.data.competitors);
    } catch {
      setError("Nettverksfeil.");
      setCompetitors(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCompetitors();
  }, [loadCompetitors]);

  const runPlan = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/market/domination", {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json()) as ApiOk<{ plan: string }> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Plan feilet.";
        setError(msg);
        return;
      }
      setPlan(j.data.plan);
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
        <Link href="/backoffice/market" className="text-sm text-slate-600 hover:text-slate-900">
          Kategori-motor
        </Link>
      </div>

      <div>
        <h1 className="font-heading text-xl font-semibold text-slate-900">Markedsdominasjon</h1>
        <p className="mt-1 text-sm text-slate-600">
          Statisk konkurrentliste + valgfritt AI-utkast for plan. Ingen automatisk publisering eller eksterne handlinger.
        </p>
      </div>

      {loading ? <p className="text-sm text-slate-600">Laster…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && competitors ? (
        <div className="space-y-6 text-left">
          <section>
            <h2 className="text-sm font-semibold text-slate-900">Konkurrenter (illustrasjon)</h2>
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-3 font-mono text-xs text-slate-800">
              {JSON.stringify(competitors, null, 2)}
            </pre>
          </section>
          <div>
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-800 transition-all duration-300 hover:scale-[1.02] hover:border-pink-400/55 disabled:opacity-50"
              onClick={() => void runPlan()}
              disabled={busy}
            >
              Generer domineringsplan (utkast)
            </button>
          </div>
          {plan ? (
            <section>
              <h2 className="text-sm font-semibold text-slate-900">Plan (utkast)</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{plan}</p>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
