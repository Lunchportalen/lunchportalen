// app/superadmin/esg/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import SuperadminEsgBenchmarkClient from "./SuperadminEsgBenchmarkClient";
import LatestMonthlyCompanyList from "./LatestMonthlyCompanyList";

export default async function SuperadminEsgPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 lp-select-text">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">ESG</h1>
        <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
          Oversikt per firma basert pÃƒÂ¥ ÃƒÂ¥rs-snapshots. Kun tall og rangering.
        </p>
      </div>

      <section className="rounded-3xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm font-semibold text-[rgb(var(--lp-text))]">Benchmark</div>
        <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          ESG-oversikt lastes under. Hvis datafeil oppstÃ¥r, vises feilmelding i listen.
        </div>
      </section>

      <div className="mt-6">
        <LatestMonthlyCompanyList />
      </div>

      <div className="mt-6">
        <SuperadminEsgBenchmarkClient />
      </div>
    </main>
  );
}
