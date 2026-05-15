// app/api/orders/[orderId]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


// ✅ Dag-10 helpers
import { jsonOk } from "@/lib/http/respond";
import { getOrderForScopedUser } from "@/lib/orders/readers/getOrderForScopedUser";
import { noStoreHeaders } from "@/lib/http/noStore";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

/* =========================================================
   Route-local jsonErr (beholder canAct:false for UI)
   - Ingen NextResponse
========================================================= */
function jsonErr(rid: string, message: string, status = 400, error?: unknown) {
  let errorVal: unknown = "ERROR";
  let detail: unknown = undefined;

  if (error !== undefined) {
    if (typeof error === "object" && error && "code" in (error as any)) {
      const code = (error as any).code;
      errorVal = typeof code === "string" ? code : "ERROR";
      if ("detail" in (error as any)) detail = (error as any).detail;
    } else if (typeof error === "string") {
      errorVal = error;
    } else if (error instanceof Error) {
      errorVal = error.message || "ERROR";
    } else {
      errorVal = error;
    }
  }

  const body: any = { ok: false, rid, error: errorVal, message, canAct: false };
  if (detail !== undefined) body.detail = detail;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...noStoreHeaders(), "content-type": "application/json; charset=utf-8" },
  });
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

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
  const { supabaseServer } = await import("@/lib/supabase/server");
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
  if (!orderId) return jsonErr(ctx.rid, "Mangler orderId.", 400, "BAD_REQUEST");

  const companyId = safeStr(scope.companyId);
  const locationId = safeStr(scope.locationId);
  const userId = safeStr(scope.userId);
  const role = safeStr(scope.role).toLowerCase();

  if (!companyId || !locationId || !userId) {
    return jsonErr(ctx.rid, "Mangler firmatilknytning (company/location).", 403, "missing_scope");
  }

  const sb = await supabaseServer();

  const scoped = await getOrderForScopedUser(sb as any, {
    orderId,
    companyId,
    locationId,
    userId,
    role,
  });

  if (!scoped) {
    return jsonErr(ctx.rid, "Ordre finnes ikke (eller du har ikke tilgang).", 404, { code: "NOT_FOUND", detail: { orderId } });
  }

  return jsonOk(ctx.rid, { order: scoped.order });
}
