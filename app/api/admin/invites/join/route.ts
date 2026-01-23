export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function cleanEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}
function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function safeName(v: any) {
  const s = String(v ?? "").trim();
  return s.length >= 2 ? s : null;
}

type Body = {
  invite: string;
  name: string;
  email: string;
  password: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<Body>;

    const invite = String(body.invite ?? "").trim();
    const name = safeName(body.name);
    const email = cleanEmail(body.email);
    const password = String(body.password ?? "");

    if (!invite) return jsonError(400, "missing_invite", "Mangler invitasjonskode.");
    if (!name) return jsonError(400, "invalid_name", "Skriv inn navn (minst 2 tegn).");
    if (!email || !isEmail(email)) return jsonError(400, "invalid_email", "Ugyldig e-postadresse.");
    if (!password || password.length < 8) return jsonError(400, "weak_password", "Passord må være minst 8 tegn.");

    const admin = supabaseAdmin();

    // 1) resolve invite
    const { data: inv, error: invErr } = await admin
      .from("company_invites")
      .select("code, company_id, revoked_at")
      .eq("code", invite)
      .maybeSingle();

    if (invErr) return jsonError(500, "db_error", "Kunne ikke validere invitasjonskode.", invErr);
    if (!inv) return jsonError(404, "not_found", "Invitasjonslenken finnes ikke.");
    if (inv.revoked_at) return jsonError(410, "revoked", "Invitasjonslenken er ikke lenger aktiv.");

    // 2) Opprett auth user
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: "employee" },
    });

    if (cErr || !created?.user) {
      return jsonError(400, "create_user_failed", "Kunne ikke opprette bruker. Er e-posten allerede i bruk?", cErr);
    }

    const userId = created.user.id;

    // 3) Opprett/oppdater profile (knytt til firma)
    const { error: upErr } = await admin.from("profiles").upsert(
      {
        user_id: userId,
        email,
        name,
        role: "employee",
        company_id: inv.company_id,
      },
      { onConflict: "user_id" }
    );

    if (upErr) {
      // Rull tilbake auth user hvis profil feiler
      await admin.auth.admin.deleteUser(userId);
      return jsonError(500, "profile_failed", "Kunne ikke lagre profil. Bruker ble ikke opprettet.", upErr);
    }

    return NextResponse.json({
      ok: true,
      user_id: userId,
      company_id: inv.company_id,
      role: "employee",
    });
  } catch (e: any) {
    return jsonError(500, "server_error", "Uventet feil ved registrering.", String(e?.message ?? e));
  }
}
