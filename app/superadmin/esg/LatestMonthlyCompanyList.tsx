"use client";

import { useEffect, useMemo, useState } from "react";

type Item = {
  company: {
    id: string;
    name: string;
  };
  month: string;
  delivered_count: number;
  cancelled_count: number;
  delivery_rate: number;
  waste_estimate_kg: number;
  co2_estimate_kg: number;
};

type ApiPayload = {
  ok: boolean;
  data?: {
    month: string | null;
    items: Item[];
  };
  month?: string | null;
  items?: Item[];
  message?: string;
};

function asPct(rate: number | null | undefined): string {
  if (rate == null || Number.isNaN(rate)) return "–";
  return `${(Number(rate) * 100).toFixed(1).replace(".", ",")} %`;
}

function asInt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "–";
  return new Intl.NumberFormat("nb-NO").format(Number(value));
}

export default function LatestMonthlyCompanyList() {
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/superadmin/esg/latest-monthly", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ApiPayload | null;

        if (!alive) return;
        if (!res.ok || !json) {
          throw new Error("Kunne ikke hente ESG-oversikt.");
        }

        const payload = json.data ?? json;
        setMonth(payload?.month ?? null);
        setItems(Array.isArray(payload?.items) ? payload.items : []);
        setError(null);
      } catch (e: any) {
        if (!alive) return;
        setMonth(null);
        setItems([]);
        setError(String(e?.message ?? "Kunne ikke hente ESG-oversikt."));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => {
      return (
        item.company.name.toLowerCase().includes(needle) ||
        item.company.id.toLowerCase().includes(needle)
      );
    });
  }, [items, q]);

  return (
    <section className="rounded-3xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-semibold">Seneste måned per firma</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            {month ? `Måned: ${month}` : "Ingen måned tilgjengelig ennå."}
          </div>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Søk firma"
          className="w-full rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] md:w-72"
        />
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-[rgb(var(--lp-muted))]">Laster…</div>
      ) : error ? (
        <div className="mt-4 text-sm text-rose-700">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="mt-4 text-sm text-[rgb(var(--lp-muted))]">Ingen treff.</div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left text-sm">
            <thead className="text-xs text-[rgb(var(--lp-muted))]">
              <tr className="border-b border-[rgb(var(--lp-border))]">
                <th className="px-2 py-2">Firma</th>
                <th className="px-2 py-2">Levert</th>
                <th className="px-2 py-2">Avbestilt</th>
                <th className="px-2 py-2">Leveringsgrad</th>
                <th className="px-2 py-2">CO2 (kg)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={`${item.company.id}:${item.month}`} className="border-b border-[rgb(var(--lp-border))]">
                  <td className="px-2 py-2">
                    <div className="font-semibold">{item.company.name}</div>
                    <div className="text-xs text-[rgb(var(--lp-muted))]">{item.company.id}</div>
                  </td>
                  <td className="px-2 py-2">{asInt(item.delivered_count)}</td>
                  <td className="px-2 py-2">{asInt(item.cancelled_count)}</td>
                  <td className="px-2 py-2">{asPct(item.delivery_rate)}</td>
                  <td className="px-2 py-2">{asInt(item.co2_estimate_kg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

