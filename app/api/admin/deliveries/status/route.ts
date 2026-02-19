// app/api/admin/deliveries/status/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function ridFrom(req: NextRequest) {
  return safeStr(req.headers.get("x-rid")) || `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isSuperadmin(ctx: any) {
  return safeStr(ctx?.scope?.role) === "superadmin";
}

export async function PATCH(req: NextRequest) {
  const rid = ridFrom(req);

  try {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return gate.res;
    const ctx = gate.ctx;

    const denyRole = requireRoleOr403(ctx, "admin.deliveries.write", ["company_admin", "superadmin"]);
    if (denyRole) return denyRole;

    if (!isSuperadmin(ctx)) {
      const denyScope = requireCompanyScopeOr403(ctx);
      if (denyScope) return denyScope;
    }

    return jsonErr(rid, "Leveringsstatus-endepunktet er skrivebeskyttet.", 405, {
      code: "READ_ONLY_ENDPOINT",
      detail: { reason: "orders status writes must go through canonical DB RPC" },
    });
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, {
      code: "UNHANDLED",
      detail: { message: safeStr(e?.message ?? e) },
    });
  }
}

export async function GET(req: NextRequest) {
  const rid = ridFrom(req);
  return jsonErr(rid, "Bruk PATCH.", 405, { code: "method_not_allowed", detail: { method: "GET" } });
}
export async function POST(req: NextRequest) {
  const rid = ridFrom(req);
  return jsonErr(rid, "Bruk PATCH.", 405, { code: "method_not_allowed", detail: { method: "POST" } });
}
export async function PUT(req: NextRequest) {
  const rid = ridFrom(req);
  return jsonErr(rid, "Bruk PATCH.", 405, { code: "method_not_allowed", detail: { method: "PUT" } });
}
export async function DELETE(req: NextRequest) {
  const rid = ridFrom(req);
  return jsonErr(rid, "Bruk PATCH.", 405, { code: "method_not_allowed", detail: { method: "DELETE" } });
}
