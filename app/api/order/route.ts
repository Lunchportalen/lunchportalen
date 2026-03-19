// app/api/order/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";
import { GET as OrdersGET, POST as OrdersPOST, DELETE as OrdersDELETE } from "@/app/api/orders/route";

async function callLegacy(rid: string, fn: (req: NextRequest) => Promise<Response>, req: NextRequest) {
  try {
    const res = await fn(req);
    if (!res) return jsonOk(rid, { ok: true, rid, data: null }, 200);
    return res;
  } catch (e: any) {
    return jsonErr(rid, "Legacy /api/order proxy failed.", 500, {
      code: "LEGACY_ORDER_PROXY_FAILED",
      detail: { message: String(e?.message ?? e) },
    });
  }
}

export async function GET(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const denyRole = requireRoleOr403(a.ctx, "order.get", ["employee", "company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const { rid } = a.ctx;
  return callLegacy(rid, OrdersGET, req);
}

export async function POST(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const denyRole = requireRoleOr403(a.ctx, "order.post", ["employee", "company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const { rid } = a.ctx;
  return callLegacy(rid, OrdersPOST, req);
}

export async function DELETE(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const denyRole = requireRoleOr403(a.ctx, "order.delete", ["employee", "company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const { rid } = a.ctx;
  return callLegacy(rid, OrdersDELETE, req);
}
