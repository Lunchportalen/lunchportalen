"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { enterpriseSurface, motion } from "@/lib/ui/tokens";

type PitchMetrics = {
  revenue: number;
  aiRevenue: number;
  conversionRate: number;
  growth: number;
  orders: number;
};

type ApiOk = { ok: true; rid: string; data: { metrics: PitchMetrics; mode: "demo" | "live" } };
type ApiErr = { ok: false; rid: string; message: string };

export default function PitchPage() {
  const [metrics, setMetrics] = useState<PitchMetrics | null>(null);
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leadStatus, setLeadStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/pitch?mode=${mode}`, { cache: "no-store" });
      const j = (await r.json()) as ApiOk | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kunne ikke laste data.";
        setError(msg);
        setMetrics(null);
        return;
      }
      setMetrics(j.data.metrics);
    } catch {
      setError("Nettverksfeil.");
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-4 py-10 text-center sm:px-6">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pitch · investor</p>
      <h1 className="font-heading text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl md:text-6xl">
        AI som driver reell omsetning — med kontroll
      </h1>
      <p className="mx-auto max-w-2xl text-base text-slate-600 sm:text-lg">
        Bytt mellom illustrative tall (demo) og sanne AI-signaler (live). Ordretotal krever eksplisitt driftstillatelse (
        <code className="text-xs">PITCH_ALLOW_ORDER_AGGREGATE</code>).
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setMode("demo")}
          className={`inline-flex min-h-[44px] min-w-[120px] items-center justify-center rounded-full border px-5 text-sm font-medium transition-all duration-300 hover:scale-[1.02] ${
            mode === "demo"
              ? "border-pink-500/60 bg-pink-50/40 text-slate-900 shadow-sm"
              : "border-slate-300 bg-white text-slate-800"
          }`}
        >
          Demo
        </button>
        <button
          type="button"
          onClick={() => setMode("live")}
          className={`inline-flex min-h-[44px] min-w-[120px] items-center justify-center rounded-full border px-5 text-sm font-medium transition-all duration-300 hover:scale-[1.02] ${
            mode === "live"
              ? "border-pink-500/60 bg-pink-50/40 text-slate-900 shadow-sm"
              : "border-slate-300 bg-white text-slate-800"
          }`}
        >
          Live
        </button>
      </div>

      {loading ? <p className="text-sm text-slate-600">Laster…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && metrics ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Omsetning" value={formatNok(metrics.revenue)} hint={mode === "live" ? "Signal / ev. aggregat" : "Demo"} />
          <MetricCard label="AI-inntekt (sporbar)" value={formatNok(metrics.aiRevenue)} />
          <MetricCard label="Konvertering" value={formatPct(metrics.conversionRate)} />
          <MetricCard label="Ordrer / vekst" value={`${metrics.orders}`} sub={metrics.growth ? `${metrics.growth} %` : "—"} />
        </div>
      ) : null}

      <ul className="mx-auto max-w-xl space-y-2 text-left text-sm text-slate-600">
        <li>• Brukes av miljøer med 100+ ansatte (kontrollert utrulling).</li>
        <li>• Mindre manuelt arbeid rundt bestilling og avstemming.</li>
        <li>• Forutsigbare lunsjkostnader — mindre matsvinn og bedre oversikt.</li>
      </ul>

      <form
        className={`mx-auto max-w-md space-y-4 rounded-2xl border border-[rgb(var(--lp-border))] p-6 text-left shadow-lg ${enterpriseSurface.glass}`}
        onSubmit={async (e) => {
          e.preventDefault();
          setLeadStatus(null);
          const fd = new FormData(e.currentTarget);
          const email = String(fd.get("email") ?? "").trim();
          const company = String(fd.get("company") ?? "").trim();
          const companySize = String(fd.get("company_size") ?? "").trim();
          try {
            const r = await fetch("/api/sales/lead", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                email,
                company: company || undefined,
                company_size: companySize ? Number(companySize) : undefined,
              }),
            });
            const j = (await r.json()) as { ok?: boolean; message?: string };
            if (!r.ok || !j || j.ok !== true) {
              setLeadStatus("Kunne ikke sende — prøv igjen.");
              return;
            }
            setLeadStatus("Takk — vi tar kontakt.");
            e.currentTarget.reset();
          } catch {
            setLeadStatus("Nettverksfeil.");
          }
        }}
      >
        <h2 className="font-heading text-lg font-semibold text-slate-900">Book demo</h2>
        <label className="block text-sm text-slate-700">
          E-post
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
            autoComplete="email"
          />
        </label>
        <label className="block text-sm text-slate-700">
          Selskap (valgfritt)
          <input name="company" type="text" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
        </label>
        <label className="block text-sm text-slate-700">
          Antall ansatte (valgfritt)
          <input name="company_size" type="number" min={0} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-pink-500/50 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:border-pink-500/70"
        >
          Send forespørsel
        </button>
        {leadStatus ? <p className="text-sm text-slate-700">{leadStatus}</p> : null}
      </form>

      <div className="flex justify-center">
        <Link
          href="/"
          className="text-sm text-slate-600 underline-offset-4 transition hover:text-slate-900 hover:underline"
        >
          Til forsiden
        </Link>
      </div>
    </div>
  );
}

function MetricCard({ label, value, hint, sub }: { label: string; value: string; hint?: string; sub?: string }) {
  return (
    <div
      className={`rounded-2xl border border-[rgb(var(--lp-border))] p-6 text-center shadow-lg ${enterpriseSurface.glass} ${motion.transition} hover:scale-[1.03]`}
    >
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</h2>
      <p className="mt-2 font-heading text-3xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
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
