// app/api/admin/auth/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function ridFrom(req: NextRequest) {
  const h = safeStr(req.headers.get("x-rid"));
  return h || `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}


/**
 * GET /api/admin/auth
 * - Brukes av admin-frontend for å sjekke om bruker er innlogget
 * - CI-safe: ingen env eller supabase-import før runtime
 */
export async function GET(req: NextRequest) {
  try {
    // ✅ LATE IMPORT – dette er hele poenget
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();

    const gate = await scopeOr401(req);
    if (gate.ok === false) return gate.res;
    const ctx = gate.ctx;

    const userId = String(ctx.scope.userId ?? "");

    // 2) Profil / rolle
    const { data: prof, error: profErr } = await sb
      .from("profiles")
      .select("role, company_id, full_name, department, email")
      .eq("id", userId)
      .maybeSingle();

    if (profErr) {
      return jsonErr(ctx.rid, "Kunne ikke lese profil.", 400, { code: "PROFILE_READ_FAILED", detail: {
        message: profErr.message,
      } });
    }

    const denyRole = requireRoleOr403(ctx, "admin.auth.read", ["company_admin", "superadmin"]);
    if (denyRole) return denyRole;

    const denyScope = requireCompanyScopeOr403(ctx);
    if (denyScope) return denyScope;

    const role = String(ctx.scope.role ?? "");
    const companyId = String(ctx.scope.companyId ?? "") || null;

    return jsonOk(ctx.rid, {
      user: {
        id: ctx.scope.userId,
        email: ctx.scope.email ?? (prof as any)?.email ?? null,
        role,
        company_id: companyId,
        full_name: (prof as any)?.full_name ?? null,
        department: (prof as any)?.department ?? null,
      },
    });
  } catch (e: any) {
    const rid = ridFrom(req);
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: {
      message: safeStr(e?.message ?? e),
    } });
  }
}

export async function POST(req: NextRequest) {
  const rid = ridFrom(req);
  return jsonErr(rid, "Bruk GET.", 405, { code: "method_not_allowed", detail: { method: "POST" } });
}
