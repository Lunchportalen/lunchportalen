"use client";

import { useEffect, useMemo, useState } from "react";

type RangeKey = "7d" | "30d";

type ApiOk = {
  ok: true;
  rid: string;
  data: {
    range: RangeKey;
    window: { from: string; to: string };
    cancellations_before_cutoff: { count: number; total_cancelled: number; rate: number | null };
    saved_meals_proxy: { count: number };
    waste_reduced_proxy: { meals: number };
    adoption: { active_users_14d: number; total_employees: number; rate_14d: number | null };
    delivery_stability: { available: boolean; message?: string };
  };
};

type ApiErr = { ok: false; rid?: string; error: string; message?: string; status?: number };

function fmtNum(n: number | null | undefined, decimals = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: decimals }).format(n);
}

function fmtPercent(n: number | null | undefined, decimals = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${fmtNum(n * 100, decimals)} %`;
}

function SectionCard({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-white/80 p-6 ring-1 ring-black/5 shadow-[0_12px_44px_-34px_rgba(0,0,0,.40)] backdrop-blur">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-neutral-600">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-neutral-50/70 p-4 ring-1 ring-black/5">
      <div className="text-xs font-semibold text-neutral-600">{label}</div>
      <div className="mt-2 text-2xl font-extrabold text-neutral-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-neutral-600">{hint}</div> : null}
    </div>
  );
}

export default function AdminInsightsClient() {
  const [range, setRange] = useState<RangeKey>("7d");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiOk["data"] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rid, setRid] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);
      setRid(null);

      try {
        const res = await fetch(`/api/admin/insights?range=${range}`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ApiOk | ApiErr | null;

        if (!alive) return;

        if (!res.ok || !json || (json as any).ok !== true) {
          const j = json as ApiErr;
          throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
        }

        setData((json as ApiOk).data);
        setRid((json as ApiOk).rid || null);
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message ?? "Kunne ikke hente innsikt."));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [range]);

  const adoptionText = useMemo(() => {
    if (!data) return "—";
    const rate = data.adoption.rate_14d;
    return rate === null ? "Ikke tilgjengelig" : fmtPercent(rate, 1);
  }, [data]);

  if (loading) {
    return (
      <SectionCard title="Innsikt" subtitle="Laster…">
        <div className="h-24 animate-pulse rounded-2xl bg-black/5" />
      </SectionCard>
    );
  }

  if (err) {
    return (
      <SectionCard title="Innsikt" subtitle="Kunne ikke hente data.">
        <div className="text-sm text-rose-700">{err}</div>
        {rid ? <div className="mt-2 text-xs text-neutral-500">RID: {rid}</div> : null}
      </SectionCard>
    );
  }

  if (!data) {
    return (
      <SectionCard title="Innsikt" subtitle="Ingen data tilgjengelig.">
        <div className="text-sm text-neutral-600">Ikke tilgjengelig.</div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Periode"
        subtitle={`Viser ${data.window.from} – ${data.window.to}`}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRange("7d")}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold ring-1 ${
                range === "7d"
                  ? "bg-black text-white ring-black"
                  : "bg-white text-neutral-900 ring-black/10 hover:bg-white"
              }`}
            >
              7d
            </button>
            <button
              onClick={() => setRange("30d")}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold ring-1 ${
                range === "30d"
                  ? "bg-black text-white ring-black"
                  : "bg-white text-neutral-900 ring-black/10 hover:bg-white"
              }`}
            >
              30d
            </button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Avbestillinger før 08:00"
            value={fmtNum(data.cancellations_before_cutoff.count)}
            hint={`Rate: ${fmtPercent(data.cancellations_before_cutoff.rate, 1)}`}
          />
          <Kpi
            label="Estimert porsjoner spart"
            value={fmtNum(data.saved_meals_proxy.count)}
            hint="Proxy: avbestillinger før cutoff"
          />
          <Kpi
            label="Estimert matsvinn redusert"
            value={fmtNum(data.waste_reduced_proxy.meals)}
            hint="Proxy: 1 avbestilling ≈ 1 porsjon spart"
          />
          <Kpi
            label="Adopsjon (14d)"
            value={adoptionText}
            hint={`${fmtNum(data.adoption.active_users_14d)} av ${fmtNum(data.adoption.total_employees)} aktive ansatte`}
          />
        </div>
        {rid ? <div className="mt-3 text-xs text-neutral-500">RID: {rid}</div> : null}
      </SectionCard>

      <SectionCard title="Leveringsstabilitet" subtitle="Avvik registreres av drift.">
        <div className="text-sm text-neutral-600">
          {data.delivery_stability.available ? "OK" : data.delivery_stability.message ?? "Ikke tilgjengelig."}
        </div>
      </SectionCard>
    </div>
  );
}

