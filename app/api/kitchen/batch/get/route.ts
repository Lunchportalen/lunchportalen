// app/api/kitchen/batch/get/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { osloTodayISODate } from "@/lib/date/oslo";
import { loadProfileByUserId } from "@/lib/db/profileLookup";

function isIsoDate(v: any) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));
}
function safeStr(v: any) {
  return String(v ?? "").trim();
}
function normSlot(v: any) {
  const s = safeStr(v).toLowerCase();
  return s || "lunch";
}

export async function GET(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "kitchen.batch.get", ["kitchen", "superadmin"]);
  if (denyRole) return denyRole;

  // confirm cookie-session
  const sb = await supabaseServer();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr || !auth?.user) return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");

  let admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonErr(rid, "Service role mangler.", 500, { code: "CONFIG_ERROR", detail: { detail: safeStr(e?.message ?? e) } });
  }

  try {
    const url = new URL(req.url);

    const dateQ = safeStr(url.searchParams.get("date")) || osloTodayISODate();
    const date = isIsoDate(dateQ) ? dateQ : "";
    const slot = normSlot(url.searchParams.get("slot"));
    const location_id = safeStr(url.searchParams.get("location_id"));

    if (!date) return jsonErr(rid, "Ugyldig dato.", 400, { code: "INVALID_DATE", detail: { date: dateQ } });
    if (!location_id) return jsonErr(rid, "Mangler location_id.", 400, "MISSING_LOCATION");

    const role = safeStr(scope?.role).toLowerCase();
    const userId = safeStr(auth?.user?.id) || safeStr(scope?.userId);
    const { data: prof, error: profErr } = await loadProfileByUserId(admin as any, userId, "company_id, location_id, disabled_at, is_active");

    if (profErr) {
      return jsonErr(rid, "Kunne ikke hente profil.", 500, { code: "DB_ERROR", detail: { message: profErr.message, code: (profErr as any).code ?? null } });
    }
    if (prof && ((prof as any).disabled_at || (prof as any).is_active === false)) {
      return jsonErr(rid, "Bruker er deaktivert.", 403, "FORBIDDEN");
    }

    const companyId = safeStr((prof as any)?.company_id);
    const profileLocationId = safeStr((prof as any)?.location_id);
    if (role === "kitchen") {
      if (!prof) return jsonErr(rid, "Mangler profil.", 403, "FORBIDDEN");
      if (!companyId) return jsonErr(rid, "Mangler firmatilknytning.", 403, "MISSING_COMPANY");
      if (date !== osloTodayISODate()) {
        return jsonErr(rid, "Kjøkken kan kun se dagens batch.", 403, { code: "FORBIDDEN_DATE", detail: { date, today: osloTodayISODate() } });
      }
      if (profileLocationId && location_id !== profileLocationId) {
        return jsonErr(rid, "Ugyldig lokasjon.", 403, "FORBIDDEN");
      }
    }

    const { data: locRow, error: locErr } = await admin
      .from("company_locations")
      .select("id, company_id")
      .eq("id", location_id)
      .maybeSingle();

    if (locErr) {
      return jsonErr(rid, "Kunne ikke hente lokasjon.", 500, { code: "DB_ERROR", detail: { message: locErr.message, code: (locErr as any).code ?? null } });
    }
    if (!locRow?.id) {
      return jsonErr(rid, "Batch finnes ikke.", 404, { code: "NOT_FOUND", detail: { date, slot, location_id } });
    }
    if (role === "kitchen" && safeStr((locRow as any).company_id) !== companyId) {
      return jsonErr(rid, "Lokasjon tilhører ikke firmaet.", 403, "FORBIDDEN");
    }

    const { data: row, error } = await admin
      .from("kitchen_batch")
      .select("delivery_date,delivery_window,company_location_id,status,packed_at,delivered_at,created_at,updated_at")
      .eq("delivery_date", date)
      .eq("delivery_window", slot)
      .eq("company_location_id", location_id)
      .maybeSingle();

    if (error) {
      return jsonErr(rid, "Kunne ikke hente batch.", 500, { code: "DB_ERROR", detail: { message: error.message, code: (error as any).code ?? null } });
    }
    if (!row) {
      return jsonErr(rid, "Batch finnes ikke.", 404, { code: "NOT_FOUND", detail: { date, slot, location_id } });
    }

    return jsonOk(rid, {
        batch: {
          delivery_date: row.delivery_date,
          delivery_window: row.delivery_window,
          company_location_id: row.company_location_id,
          status: row.status,
          packed_at: row.packed_at ?? null,
          delivered_at: row.delivered_at ?? null,
          created_at: row.created_at ?? null,
          updated_at: row.updated_at ?? null,
        },
      }, 200);
  } catch (e: any) {
    return jsonErr(rid, String(e?.message ?? e), 500, { code: "UNHANDLED", detail: { at: "kitchen/batch/get" } });
  }
}


