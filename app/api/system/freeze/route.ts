// app/api/system/freeze/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { freezeState } from "@/lib/production/freeze";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";

export async function GET(_req: NextRequest) {
  const rid = makeRid();
  try {
    const st = freezeState(new Date());
    return jsonOk(rid, { ...st }, 200);
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, {
      code: "FREEZE_STATE_FAILED",
      detail: { message: String(e?.message ?? e) },
    });
  }
}
