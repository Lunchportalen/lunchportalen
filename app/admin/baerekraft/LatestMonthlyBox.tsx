"use client";

import { useEffect, useState } from "react";

type LatestRecord = {
  month: string;
  delivered_count: number;
  cancelled_count: number;
  delivery_rate: number;
  waste_estimate_kg: number;
  co2_estimate_kg: number;
  generated_at: string | null;
};

type ApiPayload = {
  ok: boolean;
  data?: {
    companyId: string;
    month: string;
    record: LatestRecord | null;
  };
  month?: string;
  record?: LatestRecord | null;
  message?: string;
};

function asPct(rate: number | null | undefined): string {
  if (rate == null || Number.isNaN(rate)) return "–";
  return `${(Number(rate) * 100).toFixed(1).replace(".", ",")} %`;
}

function asKg(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "–";
  return `${Number(value).toFixed(2).replace(".", ",")} kg`;
}

function asInt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "–";
  return new Intl.NumberFormat("nb-NO").format(Number(value));
}

export default function LatestMonthlyBox() {
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<string | null>(null);
  const [record, setRecord] = useState<LatestRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/esg/latest-monthly", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ApiPayload | null;

        if (!alive) return;
        if (!res.ok || !json) {
          throw new Error("Kunne ikke hente ESG forrige måned.");
        }

        const payload = json.data ?? json;
        setMonth(payload?.month ?? null);
        setRecord(payload?.record ?? null);
        setError(null);
      } catch (e: any) {
        if (!alive) return;
        setError(String(e?.message ?? "Kunne ikke hente ESG forrige måned."));
        setMonth(null);
        setRecord(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="rounded-2xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
      <div className="text-sm font-semibold">Forrige måned</div>
      <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
        {month ? `Måned: ${month}` : "Ingen måned tilgjengelig ennå."}
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-[rgb(var(--lp-muted))]">Laster…</div>
      ) : error ? (
        <div className="mt-4 text-sm text-rose-700">{error}</div>
      ) : record ? (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white/70 p-3 ring-1 ring-[rgb(var(--lp-border))]">
            <div className="text-xs text-[rgb(var(--lp-muted))]">Leverte måltider</div>
            <div className="mt-1 text-lg font-semibold">{asInt(record.delivered_count)}</div>
          </div>
          <div className="rounded-xl bg-white/70 p-3 ring-1 ring-[rgb(var(--lp-border))]">
            <div className="text-xs text-[rgb(var(--lp-muted))]">Avbestilte måltider</div>
            <div className="mt-1 text-lg font-semibold">{asInt(record.cancelled_count)}</div>
          </div>
          <div className="rounded-xl bg-white/70 p-3 ring-1 ring-[rgb(var(--lp-border))]">
            <div className="text-xs text-[rgb(var(--lp-muted))]">Leveringsgrad</div>
            <div className="mt-1 text-lg font-semibold">{asPct(record.delivery_rate)}</div>
          </div>
          <div className="rounded-xl bg-white/70 p-3 ring-1 ring-[rgb(var(--lp-border))]">
            <div className="text-xs text-[rgb(var(--lp-muted))]">Estimert CO2</div>
            <div className="mt-1 text-lg font-semibold">{asKg(record.co2_estimate_kg)}</div>
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-[rgb(var(--lp-muted))]">
          Ingen ESG-data for valgt måned.
        </div>
      )}
    </section>
  );
}

