// app/api/admin/agreements/route.ts

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

export async function GET(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  // 🔐 401
  const s = await scopeOr401(req);
  if (s.ok === false) return s.res;
  const ctx = s.ctx;

  // 🔐 403
  const denyRole = requireRoleOr403(ctx, "admin.agreements.read", [
    "company_admin",
    "superadmin",
  ]);
  if (denyRole) return denyRole;

  // 🔐 Company scope
  const denyScope = requireCompanyScopeOr403(ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(ctx.scope.companyId);
  if (!companyId) {
    return jsonErr(ctx.rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");
  }

  try {
    const sb = supabaseAdmin();

    // Hent siste ACTIVE avtale
    const { data, error } = await sb
      .from("agreements")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "ACTIVE")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      // Enterprise: returner ok:true med warning
      return jsonOk(ctx.rid, {
        agreement: null,
        meta: {
          warning: "AGREEMENT_READ_FAILED",
          message: error.message,
          code: (error as any).code ?? null,
        },
      });
    }

    // Ingen aktiv avtale = gyldig tilstand
    return jsonOk(ctx.rid, {
      agreement: data ?? null,
      meta: {
        companyId,
      },
    });
  } catch (e: any) {
    // Enterprise: aldri knekk UI
    return jsonOk(ctx.rid, {
      agreement: null,
      meta: {
        warning: "AGREEMENT_UNHANDLED",
        message: String(e?.message ?? e),
      },
    });
  }
}
