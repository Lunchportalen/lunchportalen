"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type MetricsPayload = {
  metrics: {
    ts: number;
    uptimeSec: number | null;
    region: string;
  };
};

type ApiOk = { ok: true; rid: string; data: MetricsPayload };
type ApiErr = { ok: false; rid: string; message: string };

export default function GlobalOpsPage() {
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/ops/global", { credentials: "include" });
      const j = (await r.json()) as ApiOk | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kunne ikke laste globale ops-data.";
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

  const m = data?.metrics;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 text-center sm:text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/backoffice/ops" className="text-sm text-slate-600 hover:text-slate-900">
          ← Enterprise Ops
        </Link>
      </div>

      <div>
        <h1 className="font-heading text-xl font-semibold text-slate-900">Globale operasjoner</h1>
        <p className="mt-1 text-sm text-slate-600">
          Lettvekts prosess- og regionhint (superadmin). Ikke full observability-plattform.
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

      {!loading && !error && m ? (
        <ul className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm">
          <li>
            Region: <span className="font-medium">{m.region}</span>
          </li>
          <li>
            Tidspunkt (server):{" "}
            <span className="font-medium tabular-nums">{new Date(m.ts).toISOString()}</span>
          </li>
          <li>
            Prosess-oppetid (s):{" "}
            <span className="font-medium tabular-nums">{m.uptimeSec !== null ? m.uptimeSec.toFixed(1) : "—"}</span>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
