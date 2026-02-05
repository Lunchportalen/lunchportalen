// app/api/driver/orders/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { osloTodayISODate } from "@/lib/date/oslo";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { loadProfileByUserId } from "@/lib/db/profileLookup";

const allowedRoles = ["driver", "superadmin"] as const;

function asString(v: any) {
  return String(v ?? "").trim();
}
function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s = await scopeOr401(req);
  if (s.ok === false) return s.res;

  const { rid, scope } = s.ctx;

  // ✅ Send ctx (AuthedCtx) for å matche din routeGuard-typing
  const roleBlock = requireRoleOr403(s.ctx, scope.role ?? null, allowedRoles);
  if (roleBlock) return roleBlock;

  const u = new URL(req.url);
  const date = asString(u.searchParams.get("date"));
  if (date && !isISODate(date)) {
    return jsonErr(rid, "Ugyldig dato.", 400, { code: "BAD_REQUEST", detail: { date } });
  }
  const role = asString(scope?.role).toLowerCase();
  const today = osloTodayISODate();
  if (role === "driver" && date && date !== today) {
    return jsonErr(rid, "Sjåfør kan kun hente dagens ordre.", 403, { code: "FORBIDDEN_DATE", detail: { date, today } });
  }

  const admin = supabaseAdmin();

  const { data: profile, error: profErr } = await loadProfileByUserId(
    admin as any,
    String(scope.userId ?? ""),
    "company_id, location_id, disabled_at, is_active"
  );

  if (profErr || !profile) {
    return jsonErr(rid, "Mangler profil.", 403, "FORBIDDEN");
  }
  if ((profile as any).disabled_at || (profile as any).is_active === false) {
    return jsonErr(rid, "Bruker er deaktivert.", 403, "FORBIDDEN");
  }

  const companyId = asString((profile as any).company_id);
  const locationId = asString((profile as any).location_id);
  if (!companyId) {
    return jsonErr(rid, "Mangler firmatilknytning.", 403, "MISSING_COMPANY");
  }

  let q = admin
    .from("orders")
    .select("id,date,slot,status,company_id,location_id")
    .eq("company_id", companyId)
    .order("slot", { ascending: true })
    .order("created_at", { ascending: true });

  if (locationId) q = q.eq("location_id", locationId);
  if (role === "driver") q = q.eq("date", today);
  if (date && role !== "driver") q = q.eq("date", date);

  const { data, error } = await q;
  if (error) {
    return jsonErr(rid, "Kunne ikke hente driver-ordre.", 500, { code: "DB_ERROR", detail: {
      code: error.code,
      message: error.message,
    } });
  }

  return jsonOk(rid, { rows: data ?? [] }, 200);
}
