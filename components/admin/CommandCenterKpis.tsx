"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Props = {
  nextDeliveryLabel: string;
  cutoffLabel: string;
  employeesActive: number;
  employeesTotal: number;
};

type ApiOk = {
  ok: true;
  rid: string;
  data: {
    cancellations_before_cutoff: { count: number; rate: number | null };
    saved_meals_proxy: { count: number };
  };
};

type ApiErr = { ok: false; rid?: string; error: string; message?: string };

function fmtPercent(n: number | null | undefined, decimals = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(decimals)} %`;
}

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function Kpi({
  label,
  value,
  hint,
  href,
  primary,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  primary?: boolean;
}) {
  const Inner = (
    <div
      className={cx(
        "lp-motion-card group rounded-2xl p-5 ring-1 ring-black/5",
        "bg-neutral-50/70 hover:bg-white hover:shadow-[0_12px_38px_-30px_rgba(0,0,0,.45)]"
      )}
    >
      <div className="flex items-center gap-2">
        <div className="text-xs font-semibold tracking-wide text-neutral-600">{label}</div>
        {primary ? <span className="rounded-full bg-black px-2 py-0.5 text-xs font-semibold text-white">Primær</span> : null}
      </div>

      <div className="mt-2 text-2xl font-extrabold text-neutral-900">{value}</div>

      {hint ? <div className="mt-2 text-sm text-neutral-600">{hint}</div> : null}

      {href ? (
        <div className="mt-4 text-sm font-semibold text-neutral-900 opacity-80 group-hover:opacity-100">
          Åpne →
        </div>
      ) : null}
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {Inner}
    </Link>
  ) : (
    Inner
  );
}

export default function CommandCenterKpis({
  nextDeliveryLabel,
  cutoffLabel,
  employeesActive,
  employeesTotal,
}: Props) {
  const [insight, setInsight] = useState<ApiOk["data"] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/insights?range=7d", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ApiOk | ApiErr | null;
        if (!alive) return;
        if (!res.ok || !json || (json as any).ok !== true) {
          const j = json as ApiErr;
          throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
        }
        setInsight((json as ApiOk).data);
        setErr(null);
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message ?? "Kunne ikke hente innsikt."));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const adoptionValue =
    employeesTotal > 0 ? `${employeesActive} / ${employeesTotal}` : "Ikke tilgjengelig";

  const cancelledCount = insight?.cancellations_before_cutoff?.count;
  const cancelledRate = insight?.cancellations_before_cutoff?.rate ?? null;
  const savedMeals = insight?.saved_meals_proxy?.count;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Kpi
        label="Neste levering"
        value={nextDeliveryLabel}
        hint={cutoffLabel}
        href="/admin/orders"
        primary
      />
      <Kpi
        label="Adopsjon"
        value={adoptionValue}
        hint="Aktive ansatte / totalt"
        href="/admin/people"
      />
      <Kpi
        label="Avbestillinger før cut-off (7d)"
        value={cancelledCount === undefined ? "Ikke tilgjengelig" : String(cancelledCount)}
        hint={cancelledCount === undefined ? (err ? err : undefined) : `Rate: ${fmtPercent(cancelledRate, 1)}`}
        href="/admin/orders"
      />
      <Kpi
        label="Matsvinn-proxy spart"
        value={savedMeals === undefined ? "Ikke tilgjengelig" : String(savedMeals)}
        hint="Proxy: avbestillinger før 08:00"
        href="/admin/insights"
      />
    </div>
  );
}

