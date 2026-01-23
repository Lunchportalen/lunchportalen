export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function randomCode(len = 24) {
  // URL-safe code
  return crypto.randomBytes(len).toString("base64url"); // ~len*1.33 chars
}

export async function POST() {
  try {
    const sb = await supabaseServer();
    const { data: auth, error: authErr } = await sb.auth.getUser();
    if (authErr || !auth?.user) return jsonError(401, "unauthorized", "Du må være innlogget.");

    const userId = auth.user.id;

    // Finn profil → må være company_admin og ha company_id
    const { data: profile, error: pErr } = await sb
      .from("profiles")
      .select("user_id, role, company_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (pErr) return jsonError(500, "db_error", "Kunne ikke lese profil.", pErr);
    if (!profile) return jsonError(403, "forbidden", "Mangler profil/tilgang.");
    if (profile.role !== "company_admin") return jsonError(403, "forbidden", "Kun firma-admin kan invitere ansatte.");
    if (!profile.company_id) return jsonError(400, "missing_company", "Mangler firmatilknytning på kontoen din.");

    const companyId = profile.company_id;

    const admin = supabaseAdmin();

    // Revoke gamle aktive invites (så dere har én “gjeldende” lenke, enklest i drift)
    await admin
      .from("company_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("company_id", companyId)
      .is("revoked_at", null);

    // Lag ny invite
    const code = randomCode(18); // gir typisk 24-26 tegn
    const { data: inv, error: iErr } = await admin
      .from("company_invites")
      .insert({ company_id: companyId, code, created_by: userId })
      .select("code, company_id, created_at")
      .single();

    if (iErr) return jsonError(500, "db_error", "Kunne ikke opprette invitasjonslenke.", iErr);

    const base =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "http://localhost:3000";

    const url = `${base}/register?invite=${encodeURIComponent(inv.code)}`;

    return NextResponse.json({
      ok: true,
      invite: { code: inv.code, url, created_at: inv.created_at, company_id: inv.company_id },
    });
  } catch (e: any) {
    return jsonError(500, "server_error", "Uventet feil ved opprettelse av invitasjon.", String(e?.message ?? e));
  }
}
