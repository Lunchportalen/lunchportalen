"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type MarketPayload = { positioning: string; messaging: string };

type ApiOk = { ok: true; rid: string; data: MarketPayload };
type ApiErr = { ok: false; rid: string; message: string };

export default function CategoryMarketPage() {
  const [data, setData] = useState<MarketPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/market", { credentials: "include" });
      const j = (await r.json()) as ApiOk | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kunne ikke laste kategori-motor.";
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
        <h1 className="font-heading text-xl font-semibold text-slate-900">Kategori-motor</h1>
        <p className="mt-1 text-sm text-slate-600">
          AI-utkast for posisjon og messaging. Må valideres manuelt før ekstern bruk — ingen auto-publisering.
        </p>
      </div>

      {loading ? <p className="text-sm text-slate-600">Laster…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && data ? (
        <div className="space-y-6 text-left">
          <section>
            <h2 className="text-sm font-semibold text-slate-900">Posisjonering</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{data.positioning}</p>
          </section>
          <section>
            <h2 className="text-sm font-semibold text-slate-900">Messaging</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{data.messaging}</p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
