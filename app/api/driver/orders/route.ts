// app/api/driver/orders/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

const allowedRoles = ["driver", "superadmin"] as const;

function asString(v: any) {
  return String(v ?? "").trim();
}
function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export async function GET(req: NextRequest) {
  const s = await scopeOr401(req);
  if (s.ok === false) return s.res;

  const { rid, scope } = s.ctx;

  // ✅ Send ctx (AuthedCtx) for å matche din routeGuard-typing
  const roleBlock = requireRoleOr403(s.ctx, scope.role ?? null, allowedRoles);
  if (roleBlock) return roleBlock;

  const u = new URL(req.url);
  const date = asString(u.searchParams.get("date"));
  if (date && !isISODate(date)) {
    return jsonErr(400, rid, "BAD_REQUEST", "Ugyldig dato.", { date });
  }

  const admin = supabaseAdmin();

  let q = admin
    .from("orders")
    .select("id,date,slot,status,company_id,location_id")
    .order("slot", { ascending: true })
    .order("created_at", { ascending: true });

  if (date) q = q.eq("date", date);

  const { data, error } = await q;
  if (error) {
    return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente driver-ordre.", {
      code: error.code,
      message: error.message,
    });
  }

  return jsonOk({ ok: true, rid, rows: data ?? [] }, 200);
}
