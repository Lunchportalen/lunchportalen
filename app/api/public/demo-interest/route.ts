import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function deprecatedContractSentinel(rid: string) {
  return jsonOk(rid, null);
}
void deprecatedContractSentinel;

/** F4 — legacy route retired; use /demo + POST /api/public/leads/capture. */
export async function POST() {
  const rid = makeRid("dil");
  return jsonErr(
    rid,
    "Ruten er avviklet. Bruk https://app.lunchportalen.no/demo for demo-forespørsler.",
    410,
    "DEPRECATED",
  );
}
