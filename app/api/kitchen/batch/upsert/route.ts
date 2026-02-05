// app/api/kitchen/batch/upsert/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { POST as batchSetPOST } from "../set/route";

export async function POST(req: NextRequest) {
  const rid = makeRid();

  try {
    const res = await batchSetPOST(req as any);
    if (res instanceof Response) return res;
    return jsonOk(rid, res, 200);
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "KITCHEN_BATCH_UPSERT_FAILED", detail: {
      message: String(e?.message ?? e),
    } });
  }
}
