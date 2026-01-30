// app/api/orders/[orderId]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

// ✅ Dag-10 helpers
import { jsonOk } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

/* =========================================================
   Route-local jsonErr (beholder canAct:false for UI)
   - Ingen NextResponse
========================================================= */
function jsonErr(ctx: { rid: string }, status: number, error: string, message: string, detail?: any) {
  const body = { ok: false, rid: ctx.rid, error, message, canAct: false, detail: detail ?? undefined };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...noStoreHeaders(), "content-type": "application/json; charset=utf-8" },
  });
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

/* =========================================================
   Types
========================================================= */
type OrderRow = {
  id: string;
  user_id: string;
  company_id: string | null;
  location_id: string | null;

  date: string; // YYYY-MM-DD
  slot: string | null;
  status: string | null;
  note: string | null;

  created_at: string | null;
  updated_at: string | null;
};

/* =========================================================
   GET /api/orders/[orderId]
   - employee: kan kun lese egen ordre
   - company_admin: kan lese ordre i eget company/location
   - (superadmin håndteres i egne admin-endepunkt)
========================================================= */
export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  // ✅ scope gate
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const ctx = a.ctx;
  const { scope } = ctx;

  // ✅ role gate (NY SIGNATUR)
  const denyRole = requireRoleOr403(ctx, "orders.byId", ["employee", "company_admin"]);
  if (denyRole) return denyRole;

  // ✅ company scope gate (NY SIGNATUR)
  const denyScope = requireCompanyScopeOr403(ctx);
  if (denyScope) return denyScope;

  const orderId = safeStr(params?.orderId);
  if (!orderId) return jsonErr(ctx, 400, "BAD_REQUEST", "Mangler orderId.");

  const companyId = safeStr(scope.companyId);
  const locationId = safeStr(scope.locationId);
  const userId = safeStr(scope.userId);
  const role = safeStr(scope.role).toLowerCase();

  if (!companyId || !locationId || !userId) {
    return jsonErr(ctx, 403, "missing_scope", "Mangler firmatilknytning (company/location).");
  }

  const sb = await supabaseServer();

  // Tenant-sikker lesing
  let q = sb
    .from("orders")
    .select("id,user_id,company_id,location_id,date,slot,status,note,created_at,updated_at")
    .eq("id", orderId)
    .eq("company_id", companyId)
    .eq("location_id", locationId);

  // employee kan kun se sin egen ordre
  if (role === "employee") {
    q = q.eq("user_id", userId);
  }

  const { data, error } = await q.maybeSingle<OrderRow>();

  if (error) {
    return jsonErr(ctx, 500, "DB_ERROR", "Kunne ikke hente ordre.", {
      message: error.message,
      code: (error as any).code ?? null,
      orderId,
    });
  }

  if (!data) {
    return jsonErr(ctx, 404, "NOT_FOUND", "Ordre finnes ikke (eller du har ikke tilgang).", { orderId });
  }

  return jsonOk({
    ok: true,
    rid: ctx.rid,
    order: data,
  });
}
