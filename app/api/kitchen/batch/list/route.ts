// app/api/kitchen/batch/list/route.ts

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

type BatchRow = {
  delivery_date: string;
  delivery_window: string;
  company_location_id: string;
  status: string;
  packed_at: string | null;
  delivered_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export async function GET(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "kitchen.batch.list", ["kitchen", "superadmin"]);
  if (denyRole) return denyRole;

  // confirm cookie-session
  const sb = await supabaseServer();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr || !auth?.user) return jsonErr(rid, "Du mÃ¥ vÃ¦re innlogget.", 401, "UNAUTHENTICATED");

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
    if (!date) return jsonErr(rid, "Ugyldig dato.", 400, { code: "INVALID_DATE", detail: { date: dateQ } });

    const slotQ = safeStr(url.searchParams.get("slot"));
    const slot = slotQ ? normSlot(slotQ) : null;

    const locationQ = safeStr(url.searchParams.get("location_id"));
    const location_id = locationQ || null;

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
        return jsonErr(rid, "KjÃ¸kken kan kun se dagens batch.", 403, { code: "FORBIDDEN_DATE", detail: { date, today: osloTodayISODate() } });
      }
      if (profileLocationId && location_id && location_id !== profileLocationId) {
        return jsonErr(rid, "Ugyldig lokasjon.", 403, "FORBIDDEN");
      }
    }

    let allowedLocationIds: string[] | null = null;
    let effectiveLocationId = location_id || null;
    if (role === "kitchen") {
      if (profileLocationId) {
        allowedLocationIds = [profileLocationId];
        effectiveLocationId = profileLocationId;
      } else {
        let locQ = admin
          .from("company_locations")
          .select("id, company_id")
          .eq("company_id", companyId);
        if (effectiveLocationId) locQ = locQ.eq("id", effectiveLocationId);
        const { data: locRows, error: locErr } = await locQ;
        if (locErr) {
          return jsonErr(rid, "Kunne ikke hente lokasjoner.", 500, { code: "DB_ERROR", detail: { message: locErr.message, code: (locErr as any).code ?? null } });
        }
        if (effectiveLocationId && (!locRows || locRows.length === 0)) {
          return jsonErr(rid, "Lokasjon tilhÃ¸rer ikke firmaet.", 403, "FORBIDDEN");
        }
        allowedLocationIds = (locRows ?? []).map((r: any) => safeStr(r.id)).filter(Boolean);
      }
    }

    let q = admin
      .from("kitchen_batch")
      .select("delivery_date,delivery_window,company_location_id,status,packed_at,delivered_at,created_at,updated_at")
      .eq("delivery_date", date);

    if (slot) q = q.eq("delivery_window", slot);
    if (effectiveLocationId) q = q.eq("company_location_id", effectiveLocationId);
    if (role === "kitchen") {
      if (!allowedLocationIds || allowedLocationIds.length === 0) {
        return jsonOk(rid, { date, count: 0, rows: [] }, 200);
      }
      q = q.in("company_location_id", allowedLocationIds);
    }

    const { data, error } = await q;

    if (error) {
      return jsonErr(rid, "Kunne ikke hente batch-liste.", 500, { code: "DB_ERROR", detail: {
        message: error.message,
        code: (error as any).code ?? null,
      } });
    }

    const rows = ((data ?? []) as BatchRow[]).map((r) => ({
      delivery_date: r.delivery_date,
      delivery_window: normSlot(r.delivery_window),
      company_location_id: r.company_location_id,
      status: safeStr(r.status).toUpperCase(),
      packed_at: r.packed_at ?? null,
      delivered_at: r.delivered_at ?? null,
      created_at: r.created_at ?? null,
      updated_at: r.updated_at ?? null,
    }));

    // deterministisk sortering
    rows.sort((a, b) => {
      const A = `${a.delivery_window}|${a.company_location_id}`;
      const B = `${b.delivery_window}|${b.company_location_id}`;
      return A.localeCompare(B, "nb");
    });

    return jsonOk(rid, { date, count: rows.length, rows }, 200);
  } catch (e: any) {
    return jsonErr(rid, String(e?.message ?? e), 500, { code: "UNHANDLED", detail: { at: "kitchen/batch/list" } });
  }
}


