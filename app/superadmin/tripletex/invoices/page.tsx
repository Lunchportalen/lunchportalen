export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Suspense } from "react";

import {
  listProviderInvoices,
  tripletexInvoiceUrl,
} from "@/lib/superadmin/tripletexAdminData";
import TripletexInvoicesClient from "../TripletexInvoicesClient";

type SearchParams = Promise<{ status?: string; period?: string }>;

function periodFromParam(period: string): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  if (period === "current") {
    return d.toISOString().slice(0, 10);
  }
  d.setUTCMonth(d.getUTCMonth() - 2);
  return d.toISOString().slice(0, 10);
}

export default async function SuperadminTripletexInvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const status = String(sp.status ?? "ALL").trim() || "ALL";
  const period = String(sp.period ?? "3m").trim() || "3m";
  const rows = await listProviderInvoices({
    status,
    periodFrom: periodFromParam(period),
    limit: 50,
  });

  const tripletexLinks: Record<string, string | null> = {};
  for (const row of rows) {
    tripletexLinks[row.id] = tripletexInvoiceUrl(row.tripletex_invoice_id);
  }

  return (
    <Suspense fallback={<p className="text-sm text-[rgb(var(--lp-muted))]">Laster fakturaer…</p>}>
      <TripletexInvoicesClient rows={rows} status={status} period={period} tripletexLinks={tripletexLinks} />
    </Suspense>
  );
}
