// app/api/order/bulk-set/route.ts
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
 * This route upserted `day_choices` directly with the service role, bypassing
 * `lp_order_set` (orders/order_items/rollups were never written). It also depended
 * on legacy `companies.contract_week_tier` columns that no longer exist in the
 * schema, so every call already failed with COMPANY_CONTRACT_NOT_FOUND.
 * The only client (`app/today/NextWeekOrderClient.tsx`) is orphaned (not rendered).
 *
 * Canonical order writes: POST /api/orders (per day) → lp_order_set.
 */
export async function POST() {
  return jsonErr(
    makeRid("bulkset_deprecated"),
    "Bruk POST /api/orders (per dag) istedenfor",
    410,
    "DEPRECATED"
  );
}
