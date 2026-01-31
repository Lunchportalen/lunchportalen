// app/api/admin/auth/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function ridFrom(req: NextRequest) {
  const h = safeStr(req.headers.get("x-rid"));
  return h || `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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
 * GET /api/admin/auth
 * - Brukes av admin-frontend for å sjekke om bruker er innlogget
 * - CI-safe: ingen env eller supabase-import før runtime
 */
export async function GET(req: NextRequest) {
  const rid = ridFrom(req);

  try {
    // ✅ LATE IMPORT – dette er hele poenget
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();

    // 1) Auth
    const { data: auth, error: authErr } = await sb.auth.getUser();
    const user = auth?.user ?? null;
    if (authErr || !user) {
      return err(rid, 401, "UNAUTHENTICATED", "Du må være innlogget.");
    }

    // 2) Profil / rolle
    const { data: prof, error: profErr } = await sb
      .from("profiles")
      .select("role, company_id, full_name, department, email")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) {
      return err(rid, 500, "PROFILE_READ_FAILED", "Kunne ikke lese profil.", {
        message: profErr.message,
      });
    }

    const role = String((prof as any)?.role ?? "");
    const allowed = new Set(["company_admin", "superadmin", "admin"]);

    if (!allowed.has(role)) {
      return err(rid, 403, "FORBIDDEN", "Ingen tilgang.");
    }

    return ok(rid, {
      user: {
        id: user.id,
        email: user.email ?? (prof as any)?.email ?? null,
        role,
        company_id: (prof as any)?.company_id ?? null,
        full_name: (prof as any)?.full_name ?? null,
        department: (prof as any)?.department ?? null,
      },
    });
  } catch (e: any) {
    return err(rid, 500, "UNHANDLED", "Uventet feil.", {
      message: safeStr(e?.message ?? e),
    });
  }
}

export async function POST(req: NextRequest) {
  const rid = ridFrom(req);
  return err(rid, 405, "method_not_allowed", "Bruk GET.", { method: "POST" });
}
