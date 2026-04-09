// app/superadmin/sales/page.tsx — Sales Cockpit (samlet)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { loadSalesCockpitServerData } from "@/lib/sales/cockpitServerData";

import SalesCockpitClient from "./SalesCockpitClient";

export default async function SuperadminSalesPage() {
  const initial = await loadSalesCockpitServerData();

  return (
    <main className="mx-auto max-w-[1440px] pb-16 pt-2 lp-select-text">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Sales Cockpit</h1>
      <p className="mt-2 max-w-3xl text-sm text-[rgb(var(--lp-muted))]">
        Samlet oversikt: pipeline, innsikt, utrekk og kontrollerte handlinger. Data lastes på server; oppdatering skjer
        parallelt i klient.
      </p>
      <div className="mt-8">
        <SalesCockpitClient initial={initial} />
      </div>
    </main>
  );
}
