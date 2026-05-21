export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Suspense } from "react";

import { listTripletexOutbox } from "@/lib/superadmin/tripletexAdminData";
import TripletexQueueClient from "../TripletexQueueClient";

type SearchParams = Promise<{ status?: string }>;

export default async function SuperadminTripletexQueuePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const status = String(sp.status ?? "FAILED").trim() || "FAILED";
  const rows = await listTripletexOutbox({ status, limit: 50 });

  return (
    <Suspense fallback={<p className="text-sm text-[rgb(var(--lp-muted))]">Laster kø…</p>}>
      <TripletexQueueClient rows={rows} status={status} />
    </Suspense>
  );
}
