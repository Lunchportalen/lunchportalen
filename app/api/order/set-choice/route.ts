export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function deprecatedContractSentinel(rid: string) {
  return jsonOk(rid, null);
}
void deprecatedContractSentinel;

export async function POST() {
  return jsonErr(makeRid("setchoice_deprecated"), "Bruk POST /api/orders istedenfor", 410, "DEPRECATED");
}
