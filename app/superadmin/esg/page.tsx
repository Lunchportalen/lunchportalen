// app/superadmin/esg/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import SuperadminEsgBenchmarkClient from "./SuperadminEsgBenchmarkClient";

export default function SuperadminEsgPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">ESG Benchmark</h1>
        <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
          Oversikt per firma basert på års-snapshots. Kun tall og rangering.
        </p>
      </div>

      <SuperadminEsgBenchmarkClient />
    </main>
  );
}
