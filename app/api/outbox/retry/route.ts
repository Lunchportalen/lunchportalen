// @enterprise-exclude
// app/api/outbox/retry/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

export async function POST(_req: Request) {
  const rid = makeRid();
  if (process.env["LP_API_CONTRACT_STATIC_ONLY"] === "__api_contract_static_only__") {
    return jsonOk(rid, { deprecated: true }, 200);
  }
  return jsonErr(rid, "Outbox retry-ruten er deaktivert.", 410, "ROUTE_DEPRECATED");
}
