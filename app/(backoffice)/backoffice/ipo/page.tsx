"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type IpoPayload = {
  report: { revenue: number; arr: number; ltv: number; cac: number; margin: number };
  governance: { auditEvents: number; auditLogs: number; status: string };
};

type ApiOk = { ok: true; rid: string; data: IpoPayload };
type ApiErr = { ok: false; rid: string; message: string };

export default function IpoModePage() {
  const [data, setData] = useState<IpoPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/ipo", { credentials: "include" });
      const j = (await r.json()) as ApiOk | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kunne ikke laste IPO-modus.";
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
        <h1 className="font-heading text-xl font-semibold text-slate-900">IPO-modus</h1>
        <p className="mt-1 text-sm text-slate-600">
          Styredashboard (proxy-tall). Governance bygger på revisjonsvolum — ikke full compliance-vurdering.
        </p>
      </div>

      {loading ? <p className="text-sm text-slate-600">Laster…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && data ? (
        <div className="space-y-4">
          <ul className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm">
            <li>
              Omsetning (proxy): <span className="font-medium tabular-nums">{data.report.revenue}</span>
            </li>
            <li>
              ARR (proxy): <span className="font-medium tabular-nums">{data.report.arr}</span>
            </li>
            <li>
              LTV (proxy): <span className="font-medium tabular-nums">{data.report.ltv}</span>
            </li>
            <li>
              CAC (proxy): <span className="font-medium tabular-nums">{data.report.cac}</span>
            </li>
            <li>
              Margin (proxy, 60 % av omsetning):{" "}
              <span className="font-medium tabular-nums">{data.report.margin}</span>
            </li>
          </ul>
          <ul className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm">
            <li>
              Governance: <span className="font-medium">{data.governance.status}</span>
            </li>
            <li>
              audit_logs (estimat): <span className="tabular-nums">{data.governance.auditLogs}</span>
            </li>
            <li>
              audit_events (estimat): <span className="tabular-nums">{data.governance.auditEvents}</span>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
