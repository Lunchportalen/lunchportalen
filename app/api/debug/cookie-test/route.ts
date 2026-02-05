export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

export async function GET() {
  const rid = makeRid();
  try {
    const res = jsonOk(rid, { ok: true, set: true }, 200) as NextResponse;
    res.cookies.set({
      name: "lp_cookie_test",
      value: "1",
      path: "/",
      sameSite: "lax",
      secure: false, // localhost
    });
    return res;
  } catch (e: any) {
    return jsonErr(rid, "Kunne ikke sette test-cookie.", 500, { code: "COOKIE_TEST_FAILED", detail: {
      message: String(e?.message ?? e),
    } });
  }
}
