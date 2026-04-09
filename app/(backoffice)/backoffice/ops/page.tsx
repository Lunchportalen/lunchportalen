"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type OpsPayload = {
  status: string;
  events: number;
  auditLogs: number;
  auditEvents: number;
};

type ApiOk = { ok: true; rid: string; data: OpsPayload };
type ApiErr = { ok: false; rid: string; message: string };

export default function EnterpriseOpsPage() {
  const [data, setData] = useState<OpsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/ops", { credentials: "include" });
      const j = (await r.json()) as ApiOk | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kunne ikke laste ops-signaler.";
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
        <h1 className="font-heading text-xl font-semibold text-slate-900">Enterprise Ops</h1>
        <p className="mt-1 text-sm text-slate-600">
          Overvåkingsvennlig aggregat av revisjonsvolum (head count). Ikke en full SOC2-attest — synlighet for drift.
        </p>
      </div>

      {loading ? <p className="text-sm text-slate-600">Laster…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && data ? (
        <ul className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm">
          <li>
            Status: <span className="font-medium">{data.status}</span>
          </li>
          <li>
            Hendelser (samlet): <span className="font-medium tabular-nums">{data.events}</span>
          </li>
          <li>
            audit_logs (rader, estimat): <span className="font-medium tabular-nums">{data.auditLogs}</span>
          </li>
          <li>
            audit_events (rader, estimat): <span className="font-medium tabular-nums">{data.auditEvents}</span>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
