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
  password2?: string;
};

async function waitForProfile(admin: ReturnType<typeof supabaseAdmin>, userId: string) {
  const maxRetries = 25; // ~5s
  const sleepMs = 200;

  for (let i = 0; i < maxRetries; i++) {
    const { data, error } = await admin.from("profiles").select("id, company_id").eq("id", userId).maybeSingle();
    if (!error && data?.id) return data as { id: string; company_id: string | null };
    await new Promise((r) => setTimeout(r, sleepMs));
  }
  return null;
}

async function listUsersFindByEmail(admin: ReturnType<typeof supabaseAdmin>, email: string) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const hit = (data?.users ?? []).find((u: any) => String(u?.email ?? "").toLowerCase() === email);
  return hit?.id ? String(hit.id) : null;
}

export async function POST(req: Request) {
  const rid = `company_inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const body = (await req.json()) as Partial<Body>;

    const invite = String(body.invite ?? "").trim();
    const name = safeName(body.name);
    const email = cleanEmail(body.email);
    const password = String(body.password ?? "");
    const password2 = String(body.password2 ?? "");

    if (!invite) return jsonError(400, "missing_invite", "Mangler invitasjonskode.", { rid });
    if (!name) return jsonError(400, "invalid_name", "Skriv inn navn (minst 2 tegn).", { rid });
    if (!email || !isEmail(email)) return jsonError(400, "invalid_email", "Ugyldig e-postadresse.", { rid });
    if (!password || password.length < 10) return jsonError(400, "weak_password", "Passord må være minst 10 tegn.", { rid });
    if (password2 && password !== password2) return jsonError(400, "pw_mismatch", "Passordene er ikke like.", { rid });

    const admin = supabaseAdmin();

    // 1) resolve invite
    const { data: inv, error: invErr } = await admin
      .from("company_invites")
      .select("code, company_id, revoked_at")
      .eq("code", invite)
      .maybeSingle();

    if (invErr) return jsonError(500, "db_error", "Kunne ikke validere invitasjonskode.", { rid, invErr });
    if (!inv) return jsonError(404, "not_found", "Invitasjonslenken finnes ikke.", { rid });
    if ((inv as any).revoked_at) return jsonError(410, "revoked", "Invitasjonslenken er ikke lenger aktiv.", { rid });

    const company_id = String((inv as any).company_id ?? "").trim();
    if (!company_id) return jsonError(500, "invite_corrupt", "Invitasjonen mangler company_id.", { rid });

    // 2) Opprett/oppdater auth user
    // ✅ Viktig: Vi oppretter IKKE profiles her (FK-race).
    // DB-trigger på auth.users skal lage profiles-raden.
    let createdNewAuthUser = false;

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        full_name: name,
        role: "employee",
        company_id, // trigger bruker dette
      },
    });

    let userId: string | null = created?.user?.id ? String(created.user.id) : null;

    if (cErr || !userId) {
      // Hvis e-post allerede finnes: finn userId og oppdater
      const existingId = await listUsersFindByEmail(admin, email);
      if (!existingId) {
        return jsonError(400, "create_user_failed", "Kunne ikke opprette bruker. Er e-posten allerede i bruk?", {
          rid,
          detail: cErr?.message ?? cErr,
        });
      }

      userId = existingId;

      const upd = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: {
          ...(created?.user?.user_metadata ?? {}),
          name,
          full_name: name,
          role: "employee",
          company_id,
        },
      });

      if (upd.error) {
        return jsonError(500, "auth_update_failed", "Kunne ikke oppdatere eksisterende bruker.", { rid, detail: upd.error.message });
      }
    } else {
      createdNewAuthUser = true;
    }

    // 3) Vent på trigger-opprettet profile + oppdater trygge felter (IKKE company_id)
    const profile = await waitForProfile(admin, userId);
    if (!profile) {
      // Best effort rollback om vi nettopp opprettet en ny auth-user
      if (createdNewAuthUser) {
        try {
          await admin.auth.admin.deleteUser(userId);
        } catch {}
      }
      return jsonError(
        500,
        "profile_not_created",
        "Profil ble ikke opprettet automatisk. Sjekk DB-trigger på auth.users → public.profiles.",
        { rid, userId }
      );
    }

    // Sikkerhet: company_id må være satt av trigger (og matche invite)
    if (!profile.company_id) {
      return jsonError(
        500,
        "profile_not_bound",
        "Profil ble opprettet, men er ikke knyttet til firma. Trigger må sette profiles.company_id ved INSERT.",
        { rid, userId }
      );
    }
    if (String(profile.company_id) !== String(company_id)) {
      return jsonError(
        409,
        "company_mismatch",
        "Kontoen finnes allerede og er knyttet til et annet firma. Kontakt superadmin.",
        { rid, existingCompany: profile.company_id, inviteCompany: company_id }
      );
    }

    const { error: profUpdErr } = await admin
      .from("profiles")
      .update({
        email,
        name,
        full_name: name,
        role: "employee",
        is_active: true,
        disabled_at: null,
        disabled_reason: null,
      })
      .eq("id", userId);

    if (profUpdErr) {
      // Ikke slett user automatisk her – auth er allerede “sannhet”, men vi gir tydelig feil.
      return jsonError(500, "profile_update_failed", "Kunne ikke oppdatere profil.", { rid, detail: profUpdErr });
    }

    return NextResponse.json({
      ok: true,
      rid,
      user_id: userId,
      company_id,
      role: "employee",
    });
  } catch (e: any) {
    return jsonError(500, "server_error", "Uventet feil ved registrering.", { message: String(e?.message ?? e), rid: "company_inv_unknown" });
  }
}
