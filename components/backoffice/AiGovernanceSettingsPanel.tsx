"use client";

import { useEffect, useState } from "react";

type AiStatusPayload = {
  enabled: boolean;
  provider: string | null;
  model: string | null;
  errorCode: string | null;
  pos?: unknown;
};

/**
 * U20 — Lesbar AI-status fra eksisterende `/api/backoffice/ai/status` (ingen hemmeligheter i klient).
 */
export function AiGovernanceSettingsPanel() {
  const [data, setData] = useState<AiStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/backoffice/ai/status", { credentials: "include", cache: "no-store" });
        const json = (await res.json()) as {
          ok?: boolean;
          data?: AiStatusPayload;
          message?: string;
        };
        if (cancelled) return;
        if (!json?.ok || !json.data) {
          setError(json?.message ?? "Kunne ikke hente AI-status.");
          return;
        }
        setData(json.data);
        setError(null);
      } catch {
        if (!cancelled) setError("Kunne ikke hente AI-status.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
        {error}
      </section>
    );
  }

  if (!data) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Laster AI-status…</section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">AI-innstillinger (operativ status)</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Viser <strong className="font-medium text-slate-800">ikke</strong> API-nøkler. Modell/leverandør kommer fra
        sikre miljøvariabler og eksisterende runner — samme sannhet som drift.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Aktivert</dt>
          <dd className="mt-1 font-mono text-sm text-slate-900">{data.enabled ? "ja" : "nei"}</dd>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Leverandør</dt>
          <dd className="mt-1 font-mono text-sm text-slate-900">{data.provider ?? "—"}</dd>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 sm:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Modell</dt>
          <dd className="mt-1 break-all font-mono text-sm text-slate-900">{data.model ?? "—"}</dd>
        </div>
        {data.errorCode ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">Konfigurasjonskode</dt>
            <dd className="mt-1 font-mono text-sm text-amber-950">{data.errorCode}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
