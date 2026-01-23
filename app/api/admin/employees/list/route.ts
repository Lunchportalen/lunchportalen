export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

export async function GET() {
  try {
    const sb = await supabaseServer();
    const { data: auth, error: authErr } = await sb.auth.getUser();
    if (authErr || !auth?.user) return jsonError(401, "unauthorized", "Du må være innlogget.");

    const userId = auth.user.id;

    // role + company scope (RLS-safe read først)
    const { data: me, error: meErr } = await sb
      .from("profiles")
      .select("user_id, role, company_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (meErr) return jsonError(500, "db_error", "Kunne ikke lese profil.", meErr);
    if (!me) return jsonError(403, "forbidden", "Mangler profil.");
    if (me.role !== "company_admin") return jsonError(403, "forbidden", "Kun firma-admin har tilgang.");
    if (!me.company_id) return jsonError(400, "missing_company", "Mangler firmatilknytning.");

    // bruk admin til å lese uten RLS-trøbbel, men med hard scope i kode
    const admin = supabaseAdmin();
    const { data: rows, error: rowsErr } = await admin
      .from("profiles")
      .select("user_id, name, email, role, created_at, disabled_at, disabled_reason")
      .eq("company_id", me.company_id)
      .in("role", ["employee"])
      .order("created_at", { ascending: false });

    if (rowsErr) return jsonError(500, "db_error", "Kunne ikke hente ansatte.", rowsErr);

    return NextResponse.json({
      ok: true,
      employees: (rows ?? []).map((r: any) => ({
        user_id: r.user_id,
        name: r.name ?? null,
        email: r.email ?? null,
        role: r.role,
        created_at: r.created_at,
        disabled_at: r.disabled_at ?? null,
        disabled_reason: r.disabled_reason ?? null,
      })),
    });
  } catch (e: any) {
    return jsonError(500, "server_error", "Uventet feil.", String(e?.message ?? e));
  }
}
