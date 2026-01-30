export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { supabaseServer } from "@/lib/supabase/server";
import { osloTodayISODate } from "@/lib/date/oslo";

function pickResponse(x: any): Response | null {
  return (x?.res as Response) ?? (x?.response as Response) ?? (x?.r as Response) ?? null;
}
function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}
function safeStr(v: any) {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest) {
  const a: any = await scopeOr401(req);
  if (!a?.ok) return pickResponse(a) ?? new Response("Unauthorized", { status: 401 });

  const b: any = requireRoleOr403(a.ctx, ["driver", "superadmin"]);
  if (!b?.ok) return pickResponse(b) ?? new Response("Forbidden", { status: 403 });

  const ctx = b.ctx;

  const body = await readJson(req);

  const date = safeStr(body?.date) || osloTodayISODate();
  const slot = safeStr(body?.slot);
  const companyId = safeStr(body?.companyId);
  const locationId = safeStr(body?.locationId);
  const note = safeStr(body?.note) || null;

  if (!isISODate(date)) {
    return jsonErr(400, ctx.rid, "bad_request", "Invalid date. Use YYYY-MM-DD.", { date });
  }
  if (!slot || !companyId || !locationId) {
    return jsonErr(400, ctx.rid, "bad_request", "Missing required fields: slot, companyId, locationId.", {
      date,
      slot,
      companyId,
      locationId,
    });
  }

  const sb = await supabaseServer();

  const payload = {
    delivery_date: date,
    slot,
    company_id: companyId,
    location_id: locationId,
    confirmed_by: ctx.scope.userId,
    rid: ctx.rid,
    note,
  };

  const { data, error } = await sb
    .from("delivery_confirmations")
    .upsert(payload, {
      onConflict: "delivery_date,slot,company_id,location_id",
      ignoreDuplicates: false,
    })
    .select("id, delivery_date, slot, company_id, location_id, confirmed_at, confirmed_by, rid, note")
    .maybeSingle();

  if (error) {
    return jsonErr(500, ctx.rid, "db_error", "Failed to confirm delivery.", error);
  }

  return jsonOk({ ok: true, rid: ctx.rid, confirmation: data });
}
