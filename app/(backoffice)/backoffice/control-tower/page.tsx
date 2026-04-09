"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type TowerPayload = {
  runs: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
  status: string;
};

type ApiOk = { ok: true; rid: string; data: TowerPayload };
type ApiErr = { ok: false; rid: string; message: string };

export default function ControlTowerPage() {
  const [data, setData] = useState<TowerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/backoffice/control-tower", { credentials: "include" });
      const j = (await r.json()) as ApiOk | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kunne ikke laste Control Tower.";
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
        <h1 className="font-heading text-xl font-semibold text-slate-900">Control Tower</h1>
        <p className="mt-1 text-sm text-slate-600">
          Signalaggregat fra <code className="font-mono text-xs">ai_activity_log</code> (agent_run). Ingen
          auto-utførelse.
        </p>
      </div>

      {loading ? <p className="text-sm text-slate-600">Laster…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && data ? (
        <ul className="space-y-2 text-sm text-slate-800">
          <li>
            Kjøringer: <span className="font-medium">{data.runs}</span>
          </li>
          <li>
            Konverteringer: <span className="font-medium">{data.conversions}</span>
          </li>
          <li>
            Omsetning (sporbar): <span className="font-medium">{data.revenue}</span>
          </li>
          <li>
            Konverteringsrate:{" "}
            <span className="font-medium">
              {data.conversionRate > 0 ? (data.conversionRate * 100).toFixed(2) : "0"}
              %
            </span>
          </li>
          <li>
            Status: <span className="font-medium">{data.status}</span>
          </li>
        </ul>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-start">
        <Link
          href="/backoffice/autonomy/optimize"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-800 transition-all duration-300 hover:scale-[1.02] hover:border-pink-400/55"
        >
          Forbedre prompts
        </Link>
        <Link
          href="/backoffice/autonomy"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-800 transition-all duration-300 hover:scale-[1.02] hover:border-pink-400/55"
        >
          Skaler AI (anbefalinger)
        </Link>
        <Link
          href="/backoffice/autonomy"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-800 transition-all duration-300 hover:scale-[1.02] hover:border-pink-400/55"
        >
          Gjennomgå anbefalinger
        </Link>
      </div>
    </div>
  );
}
