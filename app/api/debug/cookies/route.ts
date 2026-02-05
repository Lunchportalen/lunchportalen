export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

export async function GET() {
  const rid = makeRid();
  try {
    const c = await cookies();
    const list = c.getAll().map((x) => ({ name: x.name, value: x.value.slice(0, 12) + "…" }));
    return jsonOk(rid, { ok: true, count: list.length, cookies: list }, 200);
  } catch (e: any) {
    return jsonErr(rid, "Kunne ikke lese cookies.", 500, { code: "COOKIE_READ_FAILED", detail: {
      message: String(e?.message ?? e),
    } });
  }
}
