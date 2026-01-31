// app/api/admin/employees/activity/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

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
  return NextResponse.json(
    { ok: false, rid, error: code, message, detail: detail ?? null },
    { status }
  );
}

/**
 * GET /api/admin/employees/activity
 * Roles: company_admin | superadmin
 * Runtime-only (CI-safe)
 */
export async function GET(req: NextRequest) {
  const rid = ridFrom(req);

  try {
    // 🔒 LATE IMPORT – stopper env-evaluering under build
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();

    // Auth
    const { data: auth, error: authErr } = await sb.auth.getUser();
    const user = auth?.user ?? null;
    if (authErr || !user) {
      return err(rid, 401, "UNAUTHENTICATED", "Du må være innlogget.");
    }

    // Profile
    const { data: prof, error: profErr } = await sb
      .from("profiles")
      .select("role, company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) {
      return err(rid, 500, "PROFILE_READ_FAILED", "Kunne ikke lese profil.", profErr.message);
    }

    const role = safeStr((prof as any)?.role);
    const companyId = safeStr((prof as any)?.company_id);

    if (!["company_admin", "superadmin", "admin"].includes(role)) {
      return err(rid, 403, "FORBIDDEN", "Ingen tilgang.");
    }

    if (role === "company_admin" && !companyId) {
      return err(rid, 400, "MISSING_COMPANY", "Mangler company_id.");
    }

    // 🔎 Aktivitet per ansatt (tilpasser ikke schema – bruker eksisterende tabeller)
    const { data, error } = await sb
      .from("profiles")
      .select("id, full_name, last_active_at")
      .eq("company_id", companyId)
      .eq("role", "employee")
      .order("last_active_at", { ascending: false });

    if (error) {
      return err(rid, 500, "DB_ERROR", "Kunne ikke hente ansattaktivitet.", error.message);
    }

    return ok(rid, { employees: data ?? [] });
  } catch (e: any) {
    return err(rid, 500, "UNHANDLED", "Uventet feil.", safeStr(e?.message ?? e));
  }
}

export async function POST(req: NextRequest) {
  const rid = ridFrom(req);
  return err(rid, 405, "method_not_allowed", "Bruk GET.", { method: "POST" });
}
