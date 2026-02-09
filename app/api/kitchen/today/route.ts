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
 * - viderefører også valgfri ?slot=...
 * - 307 for å bevare GET
 * - no-store headers alltid
 */
export async function GET(req: Request) {
  const rid = makeRid();

  try {
    const url = new URL(req.url);

    // Valgfri date override
    const qDate = safeStr(url.searchParams.get("date"));
    const date = qDate && isIsoDate(qDate) ? qDate : osloTodayISODate();

    // Valgfri slot passthrough
    const qSlot = safeStr(url.searchParams.get("slot"));
    const slot = qSlot ? qSlot : "";

    // Bygg absolutt URL basert på request (stabilt i prod)
    const target = new URL(req.url);
    target.pathname = "/api/kitchen/day";

    const params = new URLSearchParams();
    params.set("date", date);
    if (slot) params.set("slot", slot);
    target.search = `?${params.toString()}`;

    const res = jsonOk(rid, { ok: true, target: target.toString(), date, slot: slot || null }, 307);
    res.headers.set("Location", target.toString());

    // Hard no-store (enterprise)
    res.headers.set("Cache-Control", "no-store, max-age=0");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");

    return res;
  } catch (e: any) {
    return jsonErr(rid, "Kunne ikke redirecte til dagsview.", 500, {
      code: "KITCHEN_TODAY_FAILED",
      detail: { message: String(e?.message ?? e) },
    });
  }
}
