
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { osloTodayISODate } from "@/lib/date/oslo";
import { loadProfileByUserId } from "@/lib/db/profileLookup";

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
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a: any = await scopeOr401(req);
  if (!a?.ok) return pickResponse(a) ?? new Response("Unauthorized", { status: 401 });

  const denied = requireRoleOr403(a.ctx, ["driver", "superadmin"]);
  if (denied) return denied;

  const ctx = a.ctx;

  const body = await readJson(req);

  const today = osloTodayISODate();
  const date = safeStr(body?.date) || today;
  const slot = safeStr(body?.slot);
  const companyIdBody = safeStr(body?.companyId);
  const locationIdBody = safeStr(body?.locationId);
  const role = safeStr(ctx?.scope?.role).toLowerCase();
  const noteRaw = safeStr(body?.note) || null;
  const note = role === "driver" ? null : noteRaw;

  if (!isISODate(date)) {
    return jsonErr(ctx.rid, "Invalid date. Use YYYY-MM-DD.", 400, { code: "bad_request", detail: { date } });
  }
  if (role === "driver" && date !== today) {
    return jsonErr(ctx.rid, "Sjåfør kan kun registrere levering for i dag.", 403, { code: "FORBIDDEN_DATE", detail: {
      date,
      today,
    } });
  }
  if (!slot || !companyIdBody || !locationIdBody) {
    return jsonErr(ctx.rid, "Missing required fields: slot, companyId, locationId.", 400, { code: "bad_request", detail: {
      date,
      slot,
      companyId: companyIdBody,
      locationId: locationIdBody,
    } });
  }

  const admin = supabaseAdmin();

  const userId = safeStr(ctx?.scope?.userId);
  if (!userId) return jsonErr(ctx.rid, "Mangler bruker.", 403, "FORBIDDEN");

  const { data: prof, error: profErr } = await loadProfileByUserId(
    admin as any,
    userId,
    "company_id, location_id, disabled_at, is_active"
  );

  if (profErr || !prof) return jsonErr(ctx.rid, "Mangler profil.", 403, "FORBIDDEN");
  if ((prof as any).disabled_at || (prof as any).is_active === false) {
    return jsonErr(ctx.rid, "Bruker er deaktivert.", 403, "FORBIDDEN");
  }

  const companyId = safeStr((prof as any).company_id);
  const locationId = safeStr((prof as any).location_id);
  if (!companyId) return jsonErr(ctx.rid, "Mangler firmatilknytning.", 403, "MISSING_COMPANY");
  if (companyId !== companyIdBody) return jsonErr(ctx.rid, "Ugyldig firmatilknytning.", 403, "FORBIDDEN");
  if (locationId && locationIdBody !== locationId) {
    return jsonErr(ctx.rid, "Ugyldig lokasjon.", 403, "FORBIDDEN");
  }

  const { data: locRow, error: locErr } = await admin
    .from("company_locations")
    .select("id, company_id")
    .eq("id", locationIdBody)
    .maybeSingle();

  if (locErr || !locRow?.id || safeStr((locRow as any).company_id) !== companyId) {
    return jsonErr(ctx.rid, "Lokasjon tilhører ikke firmaet.", 403, "FORBIDDEN");
  }

  const payload = {
    delivery_date: date,
    slot,
    company_id: companyId,
    location_id: locationIdBody,
    confirmed_by: ctx.scope.userId,
    rid: ctx.rid,
    note,
  };

  const { data, error } = await admin
    .from("delivery_confirmations")
    .upsert(payload, {
      onConflict: "delivery_date,slot,company_id,location_id",
      ignoreDuplicates: false,
    })
    .select("id, delivery_date, slot, company_id, location_id, confirmed_at, confirmed_by, rid, note")
    .maybeSingle();

  if (error) {
    return jsonErr(ctx.rid, "Failed to confirm delivery.", 500, { code: "db_error", detail: error });
  }

  if (role === "driver" && data) {
    return jsonOk(ctx.rid, {
      confirmation: {
        id: data.id,
        delivery_date: data.delivery_date,
        slot: data.slot,
        location_id: data.location_id,
        confirmed_at: data.confirmed_at,
      },
    });
  }

  return jsonOk(ctx.rid, { confirmation: data });
}
