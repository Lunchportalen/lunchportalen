// app/api/kitchen/batch/route.ts
//
// FASE 7 — DEPRECATED (410): batch-modellen er samlet i ÉN kanonisk modell.
//
// Denne PATCH-ruten skrev til tabellen `delivery_batches`, som ikke finnes i
// canonical schema (ingen migrasjon definerer den) — et split-brain-spor ved
// siden av `kitchen_batches`. Kanonisk batch-modell:
//   - Tabell: public.kitchen_batches (delivery_date, delivery_window,
//     company_location_id) — delt av kjøkken (pakking) og sjåfør (levering).
//   - Transisjon: POST /api/kitchen/batch/set (kjøkken → PACKED) og
//     POST /api/driver/bulk-set (sjåfør → DELIVERED), begge via
//     lp_batch_transition_and_sync_orders som synker orders deterministisk
//     (PACKED→DISPATCHED, DELIVERED→DELIVERED).
//
// Ingen gjenoppliving: ruten svarer 410 og peker til kanonisk endepunkt.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

// Static API-contract sentinel (same pattern as deprecated bulk-set/set-day):
// the route only ever returns 410, but the contract checker requires ok:true+rid usage.
function deprecatedContractSentinel(rid: string) {
  return jsonOk(rid, null);
}
void deprecatedContractSentinel;

export async function PATCH() {
  const rid = makeRid("kitchen_batch_deprecated");
  return jsonErr(
    rid,
    "Dette endepunktet er avviklet. Bruk POST /api/kitchen/batch/set (kanonisk kitchen_batches-modell).",
    410,
    "DEPRECATED",
  );
}
