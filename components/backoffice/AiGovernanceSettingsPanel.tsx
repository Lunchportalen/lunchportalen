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
      <section className="rounded-[24px] border border-amber-200 bg-amber-50/90 p-5 text-sm text-amber-950 shadow-[var(--lp-shadow-sm)]">
        {error}
      </section>
    );
  }

  if (!data) {
    return (
      <section className="lp-card p-5 text-sm text-[rgb(var(--lp-muted))]">Laster AI-status…</section>
    );
  }

  return (
    <section className="lp-card p-6">
      <h2 className="lp-h2 text-[rgb(var(--lp-text))]">Operativ AI-status</h2>
      <p className="lp-lead mt-2 text-sm">
        Viser <strong className="font-black text-[rgb(var(--lp-text))]">ikke</strong> API-nøkler. Modell/leverandør kommer fra
        sikre miljøvariabler og eksisterende runner — samme sannhet som drift.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[rgb(var(--lp-border))]/70 bg-[rgb(var(--lp-surface-alt))]/70 px-4 py-3">
          <dt className="lp-k">Aktivert</dt>
          <dd className="mt-1 font-mono text-sm font-black text-[rgb(var(--lp-text))]">{data.enabled ? "ja" : "nei"}</dd>
        </div>
        <div className="rounded-2xl border border-[rgb(var(--lp-border))]/70 bg-[rgb(var(--lp-surface-alt))]/70 px-4 py-3">
          <dt className="lp-k">Leverandør</dt>
          <dd className="mt-1 font-mono text-sm font-black text-[rgb(var(--lp-text))]">{data.provider ?? "—"}</dd>
        </div>
        <div className="rounded-2xl border border-[rgb(var(--lp-border))]/70 bg-[rgb(var(--lp-surface-alt))]/70 px-4 py-3 sm:col-span-2">
          <dt className="lp-k">Modell</dt>
          <dd className="mt-1 break-all font-mono text-sm font-black text-[rgb(var(--lp-text))]">{data.model ?? "—"}</dd>
        </div>
        {data.errorCode ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 sm:col-span-2">
            <dt className="text-[11px] font-black uppercase tracking-wide text-amber-900">Konfigurasjonskode</dt>
            <dd className="mt-1 font-mono text-sm text-amber-950">{data.errorCode}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
