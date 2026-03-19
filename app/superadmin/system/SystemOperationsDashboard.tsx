"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTimeNO } from "@/lib/date/format";
import { Button } from "@/components/ui/button";

type HealthPayload = {
  status: "ok" | "degraded" | "critical";
  database: string;
  cron: string;
  outbox: string;
  ai_jobs: string;
  migrations: string;
  timestamp: string;
};

type HealthOk = { ok: true; rid: string; data: HealthPayload };
type HealthErr = { ok: false; rid?: string; error?: string; message?: string };

function statusTone(status: string) {
  if (status === "ok") return "bg-emerald-50 text-emerald-900 ring-emerald-200";
  if (status === "degraded") return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-rose-50 text-rose-900 ring-rose-200";
}

function rowTone(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("unavailable") || lower.includes("critical") || lower.includes("backlog")) return "text-rose-700";
  if (lower.includes("degraded") || lower.includes("elevated") || lower.includes("no recent")) return "text-amber-700";
  return "text-neutral-800";
}

export default function SystemOperationsDashboard() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rid, setRid] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/superadmin/system/health", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as HealthOk | HealthErr | null;
      if (!res.ok || !json || (json as any).ok !== true) {
        const e = json as HealthErr | null;
        setError(e?.message || e?.error || `HTTP ${res.status}`);
        setData(null);
        setRid(e?.rid ?? null);
      } else {
        const ok = json as HealthOk;
        setData(ok.data ?? null);
        setRid(ok.rid ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke hente helse.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-6 ring-1 ring-[rgb(var(--lp-border))] shadow-[var(--lp-shadow-soft)]">
        <h1 className="text-lg font-extrabold text-neutral-900">Driftsoppsummering</h1>
        <p className="mt-1 text-xs text-neutral-600">Helse, køer og migrering. Kun pålitelig status.</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button disabled={loading} variant="secondary" size="sm" onClick={load}>
            {loading ? "Oppdaterer…" : "Oppdater"}
          </Button>
          {rid ? <span className="text-xs font-mono text-neutral-500">RID: {rid}</span> : null}
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {error}
          </div>
        ) : null}

        {loading && !data ? (
          <div className="mt-4 text-sm text-neutral-600">Laster…</div>
        ) : data ? (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</span>
              <span
                className={[
                  "rounded-full px-3 py-1 text-xs font-semibold ring-1",
                  statusTone(data.status),
                ].join(" ")}
              >
                {data.status.toUpperCase()}
              </span>
              <span className="text-xs text-neutral-500">
                Sist oppdatert: {data.timestamp ? formatDateTimeNO(data.timestamp) : "—"}
              </span>
            </div>

            <dl className="grid gap-3 border-t border-[rgb(var(--lp-border))] pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-sm font-medium text-neutral-700">Database</dt>
                <dd className={["text-sm font-medium", rowTone(data.database)].join(" ")}>{data.database}</dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-sm font-medium text-neutral-700">Cron</dt>
                <dd className={["text-sm font-medium", rowTone(data.cron)].join(" ")}>{data.cron}</dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-sm font-medium text-neutral-700">Outbox-kø</dt>
                <dd className={["text-sm font-medium", rowTone(data.outbox)].join(" ")}>{data.outbox}</dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-sm font-medium text-neutral-700">AI-jobber</dt>
                <dd className={["text-sm font-medium", rowTone(data.ai_jobs)].join(" ")}>{data.ai_jobs}</dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-sm font-medium text-neutral-700">Migreringer</dt>
                <dd className={["text-sm font-medium", rowTone(data.migrations)].join(" ")}>{data.migrations}</dd>
              </div>
            </dl>

            <div className="border-t border-[rgb(var(--lp-border))] pt-3 text-xs text-neutral-500">
              Tidsstempel: {data.timestamp || "—"}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
