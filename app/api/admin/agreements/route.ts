// app/api/admin/agreements/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { GET as agreementGET } from "../agreement/route";

export async function GET(req: NextRequest) {
  const rid = makeRid();

  try {
    const res = await agreementGET(req);

    // In your codebase, route handlers should return Response.
    if (res instanceof Response) return res;

    // Fallback: enforce API contract if handler ever returns plain data.
    return jsonOk(rid, res, 200);
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, {
      code: "AGREEMENTS_PROXY_FAILED",
      detail: { message: String(e?.message ?? e) },
    });
  }
}
