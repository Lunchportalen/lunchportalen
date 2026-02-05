// app/api/kitchen/today/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { isIsoDate, osloTodayISODate } from "@/lib/date/oslo";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * GET /api/kitchen/today
 * - redirect (read-only) til /api/kitchen/day?date=YYYY-MM-DD
 * - valgfri query: ?date=YYYY-MM-DD
 * - 307 for å bevare GET
 * - no-store headers alltid
 */
export async function GET(req: Request) {
  const rid = makeRid();

  try {
    const url = new URL(req.url);

    // Valgfri date override
    const q = safeStr(url.searchParams.get("date"));
    const date = q && isIsoDate(q) ? q : osloTodayISODate();

    // Bygg absolutt URL basert på request (stabilt i prod)
    const u = new URL(req.url);
    u.pathname = "/api/kitchen/day";
    u.search = `?date=${encodeURIComponent(date)}`;

    const res = jsonOk(rid, { ok: true, target: u.toString(), date }, 307);
    res.headers.set("Location", u.toString());
    return res;
  } catch (e: any) {
    return jsonErr(rid, "Kunne ikke redirecte til dagsview.", 500, { code: "KITCHEN_TODAY_FAILED", detail: {
      message: String(e?.message ?? e),
    } });
  }
}
