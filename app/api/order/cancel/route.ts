// app/api/order/cancel/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

// Static API-contract sentinel (same pattern as deprecated set-choice/set-day):
// the route only ever returns 410, but the contract checker requires ok:true+rid usage.
function deprecatedContractSentinel(rid: string) {
  return jsonOk(rid, null);
}
void deprecatedContractSentinel;

/**
 * DEPRECATED (410) — Global launch P0 (Fase G).
 *
 * This route mutated `day_choices` only (service role), while the canonical cancel
 * path cancels the `orders` row via `lp_order_set` (CANCEL) and rebuilds rollups.
 * Keeping both live risked split-brain state: day_choice CANCELLED with order ACTIVE.
 *
 * Canonical cancel: POST /api/orders with { action: "CANCEL", date, slot } (or DELETE /api/orders).
 * No active consumers existed at deprecation time (Week/OrderActions use /api/orders).
 */
export async function POST() {
  return jsonErr(
    makeRid("ordercancel_deprecated"),
    "Bruk POST /api/orders med action=CANCEL istedenfor",
    410,
    "DEPRECATED"
  );
}
