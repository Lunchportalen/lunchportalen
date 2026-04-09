"use client";

import Link from "next/link";

import { getDemoMetrics } from "@/lib/demo/data";
import { enterpriseSurface, motion } from "@/lib/ui/tokens";

export default function InvestorPage() {
  const data = getDemoMetrics();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 text-center sm:px-6">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Investor · demo</p>
      <h1 className="mt-3 font-heading text-3xl font-semibold text-slate-900 sm:text-4xl md:text-5xl">
        AI som driver omsetning — kontrollert og målbar
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
        Tallene under er illustrative (demo). Integrasjon mot faktiske signaler skjer i backoffice.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Omsetning (demo)" value={formatNok(data.revenue)} />
        <MetricCard label="AI-attributt (demo)" value={formatNok(data.aiRevenue)} />
        <MetricCard label="Konvertering" value={formatPct(data.conversionRate)} />
        <MetricCard label="Vekst" value={`${data.growth}%`} sub={`${data.orders} ordrer (demo)`} />
      </div>

      <section className="mt-16 space-y-4 text-left">
        <h2 className="text-center font-heading text-lg font-semibold text-slate-900">Før AI</h2>
        <p className="mx-auto max-w-2xl text-center text-sm text-slate-600">
          Fragmenterte innsikter, manuelle oppfølginger og begrenset sporbarhet fra klikk til inntekt.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-left">
        <h2 className="text-center font-heading text-lg font-semibold text-slate-900">Etter AI</h2>
        <p className="mx-auto max-w-2xl text-center text-sm text-slate-600">
          Samlet signalflate, tydelige anbefalinger og revisjonsspor — uten å korte ut godkjenning for
          virkningsfulle handlinger.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-left">
        <h2 className="text-center font-heading text-lg font-semibold text-slate-900">Autonom motor</h2>
        <p className="mx-auto max-w-2xl text-center text-sm text-slate-600">
          Forslag og logging på enterprise-vis; ingenting destruktivt kjører uten eksplisitt styringslag.
        </p>
      </section>

      <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 px-5 text-sm font-medium text-slate-800 transition-all duration-300 hover:scale-[1.02] hover:border-pink-400/60 hover:shadow-md"
        >
          Til forsiden
        </Link>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className={`rounded-2xl border border-[rgb(var(--lp-border))] p-4 text-center shadow-md ${enterpriseSurface.glass} ${motion.transition} hover:scale-[1.03]`}
    >
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</h2>
      <p className="mt-2 font-heading text-2xl font-semibold text-slate-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

function formatNok(n: number) {
  return `${n.toLocaleString("nb-NO")} kr`;
}

function formatPct(r: number) {
  return `${(r * 100).toFixed(1)} %`;
}
