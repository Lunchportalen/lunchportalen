// app/api/company/create/route.ts
// DEPRECATED — canonical: POST /api/onboarding/complete
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function deprecatedContractSentinel(rid: string) {
  return jsonOk(rid, null);
}
void deprecatedContractSentinel;

export async function POST(_req: NextRequest) {
  const rid = makeRid();
  return jsonErr(
    rid,
    "Denne ruten er avviklet. Bruk POST /api/onboarding/complete for ny registrering.",
    410,
    { code: "DEPRECATED", canonical: "/api/onboarding/complete" },
  );
}
