export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Suspense } from "react";

import { listWebhookEvents } from "@/lib/superadmin/tripletexAdminData";
import TripletexWebhooksClient from "../TripletexWebhooksClient";

type SearchParams = Promise<{ status?: string; event_type?: string }>;

export default async function SuperadminTripletexWebhooksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const status = String(sp.status ?? "ALL").trim() || "ALL";
  const eventType = String(sp.event_type ?? "").trim();
  const rows = await listWebhookEvents({ status, eventType, limit: 50 });

  return (
    <Suspense fallback={<p className="text-sm text-[rgb(var(--lp-muted))]">Laster webhooks…</p>}>
      <TripletexWebhooksClient rows={rows} status={status} eventType={eventType} />
    </Suspense>
  );
}
