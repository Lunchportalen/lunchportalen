// app/superadmin/investor/page.tsx — investor dashboard (indikatorer, ikke markedsplassering)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { buildInvestorValuationResult } from "@/lib/finance/runInvestorValuation";

import InvestorDashboardClient from "./InvestorDashboardClient";

export default async function SuperadminInvestorPage() {
  const initial = await buildInvestorValuationResult({ log: false });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Investor</h1>
        <p className="mt-2 max-w-3xl text-sm text-[rgb(var(--lp-muted))]">
          Verdivurdering og KPI-er er deterministiske, forklarbare og basert på faktiske ordre og pipeline. Ingen
          automatisk handel eller justering av eksterne kontoer — kun beslutningsstøtte.
        </p>
      </div>
      <InvestorDashboardClient initial={initial} />
    </main>
  );
}
