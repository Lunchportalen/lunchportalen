
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function deprecatedContractSentinel(rid: string) {
  return jsonOk(rid, null);
}
void deprecatedContractSentinel;

export async function POST() {
  const rid = makeRid();

  return jsonErr(rid, "Dette endepunktet er ikke lenger i bruk. Bruk /api/driver/bulk-set.", 410, "DEPRECATED");
}
