"use client";

import { useCallback, useState } from "react";

type SalesPayload = {
  pipeline: { stage: string; score: string };
  outreach: string;
  meeting: { status: string } | null;
};

type ClosingPayload = { closing: { status: string } };

type ApiOk = { ok: true; rid: string; data: SalesPayload | ClosingPayload };
type ApiErr = { ok: false; rid: string; message: string; error?: string };

export default function SalesMachinePage() {
  const [data, setData] = useState<SalesPayload | ClosingPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (mode: "pipeline" | "close") => {
    setLoading(true);
    setError(null);
    try {
      const body =
        mode === "close"
          ? { action: "close_deal" as const }
          : {
              lead: { company: "Demo AS", company_size: 120 },
              requestMeeting: true,
            };

      const r = await fetch("/api/sales/run", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as ApiOk | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kunne ikke kjøre salgsflyt.";
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 text-center sm:text-left">
      <div>
        <h1 className="font-heading text-xl font-semibold text-slate-900">Sales Machine</h1>
        <p className="mt-1 text-sm text-slate-600">
          Pipeline og outreach (superadmin). Krever PRODUCTION_MODE=true for live-kjøring. Avslutning av avtale krever
          alltid godkjenning.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
        <button
          type="button"
          onClick={() => void run("pipeline")}
          disabled={loading}
          className="rounded-full border border-pink-500 px-4 py-2 text-sm font-medium text-pink-600 shadow-sm hover:bg-pink-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500 min-h-[44px] min-w-[44px] disabled:opacity-50"
        >
          Kjør pipeline
        </button>
        <button
          type="button"
          onClick={() => void run("close")}
          disabled={loading}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 min-h-[44px] min-w-[44px] disabled:opacity-50"
        >
          Simuler avslutning (krever godkjenning)
        </button>
      </div>

      {loading ? <p className="text-sm text-slate-600">Kjører…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && data ? (
        <pre className="max-h-[480px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-xs text-slate-800">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
