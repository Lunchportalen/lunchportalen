// app/api/kitchen/batch/get/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { isIsoDate, osloTodayISODate } from "@/lib/date/oslo";

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
  if (authErr || !auth?.user) return jsonErr(401, rid, "UNAUTHENTICATED", "Du må være innlogget.");

  let admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonErr(500, rid, "CONFIG_ERROR", "Service role mangler.", { detail: safeStr(e?.message ?? e) });
  }

  try {
    const url = new URL(req.url);

    const dateQ = safeStr(url.searchParams.get("date")) || osloTodayISODate();
    const date = isIsoDate(dateQ) ? dateQ : "";
    const slot = normSlot(url.searchParams.get("slot"));
    const location_id = safeStr(url.searchParams.get("location_id"));

    if (!date) return jsonErr(400, rid, "INVALID_DATE", "Ugyldig dato.", { date: dateQ });
    if (!location_id) return jsonErr(400, rid, "MISSING_LOCATION", "Mangler location_id.");

    const { data: row, error } = await admin
      .from("kitchen_batch")
      .select("delivery_date,delivery_window,company_location_id,status,packed_at,delivered_at,created_at,updated_at")
      .eq("delivery_date", date)
      .eq("delivery_window", slot)
      .eq("company_location_id", location_id)
      .maybeSingle();

    if (error) {
      return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente batch.", { message: error.message, code: (error as any).code ?? null });
    }

    return jsonOk({
      ok: true,
      rid,
      batch: row
        ? {
            delivery_date: row.delivery_date,
            delivery_window: row.delivery_window,
            company_location_id: row.company_location_id,
            status: row.status,
            packed_at: row.packed_at ?? null,
            delivered_at: row.delivered_at ?? null,
            created_at: row.created_at ?? null,
            updated_at: row.updated_at ?? null,
          }
        : null,
    });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", String(e?.message ?? e), { at: "kitchen/batch/get" });
  }
}


