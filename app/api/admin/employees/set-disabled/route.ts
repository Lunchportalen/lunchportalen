export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

type Body = {
  user_id: string;
  disabled: boolean;
  reason?: string | null;
};

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

export async function POST(req: Request) {
  try {
    const sb = await supabaseServer();
    const { data: auth, error: authErr } = await sb.auth.getUser();
    if (authErr || !auth?.user) return jsonError(401, "unauthorized", "Du må være innlogget.");

    const meId = auth.user.id;

    const { data: me, error: meErr } = await sb
      .from("profiles")
      .select("user_id, role, company_id")
      .eq("user_id", meId)
      .maybeSingle();

    if (meErr) return jsonError(500, "db_error", "Kunne ikke lese profil.", meErr);
    if (!me) return jsonError(403, "forbidden", "Mangler profil.");
    if (me.role !== "company_admin") return jsonError(403, "forbidden", "Kun firma-admin har tilgang.");
    if (!me.company_id) return jsonError(400, "missing_company", "Mangler firmatilknytning.");

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body) return jsonError(400, "bad_json", "Ugyldig JSON.");

    if (!isUuid(body.user_id)) return jsonError(400, "invalid_user_id", "Ugyldig user_id.");
    const disabled = !!body.disabled;
    const reason = safeText(body.reason);

    // Sikkerhet: sjekk at brukeren du endrer faktisk er ansatt i ditt firma
    const admin = supabaseAdmin();

    const { data: target, error: tErr } = await admin
      .from("profiles")
      .select("user_id, company_id, role")
      .eq("user_id", body.user_id)
      .maybeSingle();

    if (tErr) return jsonError(500, "db_error", "Kunne ikke lese ansatt.", tErr);
    if (!target) return jsonError(404, "not_found", "Fant ikke ansatt.");
    if (target.company_id !== me.company_id) return jsonError(403, "forbidden", "Kan kun endre ansatte i eget firma.");
    if (target.role !== "employee") return jsonError(400, "invalid_target", "Kun ansatte kan deaktiveres her.");

    const patch = disabled
      ? { disabled_at: new Date().toISOString(), disabled_reason: reason ?? "Deaktivert av firma-admin" }
      : { disabled_at: null, disabled_reason: null };

    const { error: uErr } = await admin.from("profiles").update(patch).eq("user_id", body.user_id);
    if (uErr) return jsonError(500, "db_error", "Kunne ikke oppdatere ansatt.", uErr);

    return NextResponse.json({ ok: true, user_id: body.user_id, disabled });
  } catch (e: any) {
    return jsonError(500, "server_error", "Uventet feil.", String(e?.message ?? e));
  }
}
