"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type CeoPayload = { decision: unknown };

type ApiOk = { ok: true; rid: string; data: CeoPayload };
type ApiErr = { ok: false; rid: string; message: string };

export default function BusinessCeoPage() {
  const [data, setData] = useState<CeoPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/ceo/run", { credentials: "include" });
      const j = (await r.json()) as ApiOk | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kunne ikke kjøre AI CEO.";
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
        <Link href="/backoffice/ops" className="text-sm text-slate-600 hover:text-slate-900">
          ← Enterprise Ops
        </Link>
      </div>

      <div>
        <h1 className="font-heading text-xl font-semibold text-slate-900">AI CEO</h1>
        <p className="mt-1 text-sm text-slate-600">
          Strategisk forslag (superadmin). Ingen automatisk inntektsbokføring — kun anbefaling.
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
        <pre className="max-h-[480px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-xs text-slate-800">
          {JSON.stringify(data.decision, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
