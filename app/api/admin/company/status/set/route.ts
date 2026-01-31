// app/api/admin/company/status/set/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function ridFrom(req: NextRequest) {
  return safeStr(req.headers.get("x-rid")) || `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function ok(rid: string, body: any, status = 200) {
  return NextResponse.json({ ok: true, rid, ...body }, { status });
}
function err(rid: string, status: number, code: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error: code, message, detail: detail ?? null }, { status });
}

async function readJsonLoose(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/company/status/set
 * Body: { status: "ACTIVE" | "PAUSED" | "CLOSED", companyId?: string }
 * Roles: company_admin | superadmin
 */
export async function POST(req: NextRequest) {
  const rid = ridFrom(req);
  const body = (await readJsonLoose(req)) ?? {};
  const status = safeStr(body.status).toUpperCase();

  if (!["ACTIVE", "PAUSED", "CLOSED"].includes(status)) {
    return err(rid, 400, "BAD_STATUS", "Ugyldig status.", { status });
  }

  try {
    // 🔑 LATE IMPORT – stopper env-evaluering under build
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();

    // Auth
    const { data: auth, error: authErr } = await sb.auth.getUser();
    const user = auth?.user ?? null;
    if (authErr || !user) return err(rid, 401, "UNAUTHENTICATED", "Du må være innlogget.");

    // Profil
    const { data: prof, error: profErr } = await sb
      .from("profiles")
      .select("role, company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) return err(rid, 500, "PROFILE_READ_FAILED", "Kunne ikke lese profil.");

    const role = String((prof as any)?.role ?? "");
    const ownCompanyId = safeStr((prof as any)?.company_id);
    const targetCompanyId =
      role === "superadmin" ? safeStr(body.companyId) || ownCompanyId : ownCompanyId;

    if (!targetCompanyId) {
      return err(rid, 400, "MISSING_COMPANY", "Mangler companyId.");
    }

    if (!["company_admin", "superadmin", "admin"].includes(role)) {
      return err(rid, 403, "FORBIDDEN", "Ingen tilgang.");
    }

    const { error: upErr } = await sb
      .from("companies")
      .update({ status })
      .eq("id", targetCompanyId);

    if (upErr) return err(rid, 500, "DB_ERROR", "Kunne ikke oppdatere status.", upErr.message);

    return ok(rid, { companyId: targetCompanyId, status });
  } catch (e: any) {
    return err(rid, 500, "UNHANDLED", "Uventet feil.", safeStr(e?.message ?? e));
  }
}

export async function GET(req: NextRequest) {
  const rid = ridFrom(req);
  return err(rid, 405, "method_not_allowed", "Bruk POST.", { method: "GET" });
}
