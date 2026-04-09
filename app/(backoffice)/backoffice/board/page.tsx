"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type BoardPayload = {
  arr: number;
  revenue: number;
  ltv: number;
  forecast: number;
  forecastCurrent: number;
};

type ApiOk = { ok: true; rid: string; data: BoardPayload };
type ApiErr = { ok: false; rid: string; message: string };

export default function BoardRoomPage() {
  const [data, setData] = useState<BoardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/board", { credentials: "include" });
      const j = (await r.json()) as ApiOk | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kunne ikke laste board.";
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
    <div className="mx-auto max-w-[1440px] space-y-8 p-6 text-center sm:text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/backoffice/ai" className="text-sm text-slate-600 hover:text-slate-900">
          ← AI Command Center
        </Link>
      </div>

      <div className="space-y-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          Sanntidsinnsikt — AI-drevet omsetningsmotor (proxy)
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Enterprise-grade system · Deterministiske AI-beslutninger · Sporbar og kontrollert
        </p>
      </div>

      {loading ? <p className="text-sm text-slate-600">Laster…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "ARR (proxy)", value: data.arr },
            { label: "Omsetning (proxy)", value: data.revenue },
            { label: "LTV (proxy)", value: data.ltv },
            { label: "Prognose (AI-motor)", value: data.forecast },
          ].map((cell) => (
            <div
              key={cell.label}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-300 hover:scale-[1.03]"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{cell.label}</p>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">{cell.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && !error && data ? (
        <p className="text-xs text-slate-500">
          Grunnlag prognose (nå): <span className="font-mono tabular-nums">{data.forecastCurrent}</span>
        </p>
      ) : null}
    </div>
  );
}
