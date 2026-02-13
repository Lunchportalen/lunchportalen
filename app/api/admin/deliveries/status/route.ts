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

type Target = "PACKED" | "DELIVERED";
type Body = { deliveryId: string; status: Target };

function isSuperadmin(ctx: any) {
  return safeStr(ctx?.scope?.role) === "superadmin";
}

function norm(s: unknown) {
  const u = safeStr(s || "QUEUED").toUpperCase();
  if (u === "DELIVERED") return "DELIVERED";
  if (u === "PACKED") return "PACKED";
  if (u === "ACTIVE") return "QUEUED"; // ACTIVE → behandles som QUEUED i leveringsvisning
  if (u === "CANCELLED" || u === "CANCELED") return "CANCELLED";
  return u || "QUEUED";
}
function rank(s: string) {
  const u = norm(s);
  if (u === "DELIVERED") return 2;
  if (u === "PACKED") return 1;
  return 0;
}
function isValidTarget(s: string): s is Target {
  const u = safeStr(s).toUpperCase();
  return u === "PACKED" || u === "DELIVERED";
}

async function readBody(req: NextRequest): Promise<Partial<Body> | null> {
  try {
    // If body is empty or invalid JSON, this throws → return null
    return (await req.json()) as any;
  } catch {
    return null;
  }
}

export async function PATCH(req: NextRequest) {
  const rid = ridFrom(req);

  try {
    // ✅ Auth gate
    const gate = await scopeOr401(req);
    if (gate.ok === false) return gate.res;
    const ctx = gate.ctx;

    // ✅ Role gate
    const denyRole = requireRoleOr403(ctx, "admin.deliveries.write", ["company_admin", "superadmin"]);
    if (denyRole) return denyRole;

    // ✅ company_admin MUST have company scope
    if (!isSuperadmin(ctx)) {
      const denyScope = requireCompanyScopeOr403(ctx);
      if (denyScope) return denyScope;
    }

    // ✅ Robust JSON read (no dependency on routeGuard readJson typing)
    const body = await readBody(req);

    const deliveryId = safeStr(body?.deliveryId);
    const targetRaw = safeStr(body?.status);

    if (!deliveryId) return jsonErr(rid, "Mangler deliveryId.", 400, "MISSING_ID");
    if (!isValidTarget(targetRaw)) {
      return jsonErr(rid, "Ugyldig status.", 400, { code: "INVALID_STATUS", detail: { status: targetRaw } });
    }
    const target = targetRaw.toUpperCase() as Target;

    // ✅ Late import – stopper env-evaluering under next build
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();

    const companyIdScope = safeStr(ctx?.scope?.companyId);
    if (!isSuperadmin(ctx) && !companyIdScope) {
      return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");
    }

    // 1) Read order (orders = fasit)
    const { data: row, error: rErr } = await sb
      .from("orders")
      .select("id, company_id, status, updated_at")
      .eq("id", deliveryId)
      .maybeSingle();

    if (rErr) {
      return jsonErr(rid, "Kunne ikke lese ordre.", 400, {
        code: "DB_READ_ERROR",
        detail: { message: rErr.message },
      });
    }
    if (!row) return jsonErr(rid, "Ordre finnes ikke.", 404, "NOT_FOUND");

    const rowCompanyId = safeStr((row as any).company_id);

    // 2) Tenant isolation
    if (!isSuperadmin(ctx) && rowCompanyId !== companyIdScope) {
      return jsonErr(rid, "Ikke tilgang til denne ordren.", 403, "TENANT_VIOLATION");
    }

    const current = norm((row as any).status);

    // 3) Idempotent: never downgrade
    if (rank(current) >= rank(target)) {
      return jsonOk(rid, {
        ok: true,
        rid,
        idempotent: true,
        deliveryId,
        companyId: rowCompanyId,
        status: current,
        updated: false,
      });
    }

    // 4) Update order.status
    const patch: Record<string, any> = {
      status: target,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: uErr } = await sb
      .from("orders")
      .update(patch)
      .eq("id", deliveryId)
      .select("id, company_id, status, updated_at")
      .maybeSingle();

    if (uErr) {
      return jsonErr(rid, "Kunne ikke oppdatere status.", 400, {
        code: "DB_UPDATE_ERROR",
        detail: { message: uErr.message },
      });
    }

    return jsonOk(rid, {
      ok: true,
      rid,
      idempotent: false,
      deliveryId,
      companyId: rowCompanyId,
      status: norm((updated as any)?.status ?? target),
      updated: true,
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
