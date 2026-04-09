// app/superadmin/sales-loop/page.tsx — Salgsloop (plan + godkjente utkast)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import SalesLoopClient from "./SalesLoopClient";

export default function SuperadminSalesLoopPage() {
  return (
    <main className="mx-auto max-w-[1440px] pb-16 pt-2 lp-select-text">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Salgsloop</h1>
      <p className="mt-2 max-w-3xl text-sm text-[rgb(var(--lp-muted))]">
        Prioritering, foreslåtte oppfølginger og lagring av utkast etter eksplisitt valg. Cron kjører kun planlegging;
        ingen automatisk utsending.
      </p>
      <div className="mt-8">
        <SalesLoopClient />
      </div>
    </main>
  );
}
