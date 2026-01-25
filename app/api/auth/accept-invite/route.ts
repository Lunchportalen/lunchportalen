// app/api/auth/accept-invite/route.ts
// ✅ Oppdatert til ny FASIT:
// - profiles PK/FK er `id` (profiles_id_fkey -> auth.users.id)
// - IKKE upsert/insert profiles her (unngår FK-race). Profil skal opprettes av DB-trigger på auth.users.
// - Vi setter company_id/location_id/department/full_name i user_metadata ved create/update auth-user.
// - Venter til profiles-raden finnes (trigger), verifiserer at company_id er riktig, oppdaterer kun trygge felter.
// - Marker invite brukt til slutt.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function findUserIdByEmail(admin: ReturnType<typeof supabaseAdmin>, email: string) {
  const listRes = await admin.auth.admin.listUsers({ perPage: 1000, page: 1 });
  const users = (listRes as any)?.data?.users as any[] | undefined;
  const hit = users?.find((u) => normEmail(u?.email) === email);
  return hit?.id ? String(hit.id) : null;
}

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

export async function POST(req: Request) {
  const rid = `acc_inv_${Math.random().toString(16).slice(2)}`;

  try {
    const body = await req.json().catch(() => ({}));

    const token = safeText(body?.token);
    const full_name = safeText(body?.full_name ?? body?.name);
    const password = String(body?.password ?? "");
    const password2 = String(body?.password2 ?? "");

    if (!token) return jsonError(400, "bad_request", "Mangler token.", { rid });
    if (!password || password.length < 10) return jsonError(400, "bad_request", "Passord må være minst 10 tegn.", { rid });
    if (password2 && password !== password2) return jsonError(400, "bad_request", "Passordene er ikke like.", { rid });

    const admin = supabaseAdmin();
    const token_hash = sha256Hex(token);

    // 1) Finn invitasjonen
    const { data: invite, error: invErr } = await admin
      .from("employee_invites")
      .select("id, email, company_id, location_id, department, full_name, expires_at, used_at, token_hash")
      .eq("token_hash", token_hash)
      .is("used_at", null)
      .maybeSingle();

    if (invErr) return jsonError(500, "db_error", "Kunne ikke lese invitasjon.", { rid, invErr });
    if (!invite) return jsonError(400, "invite_invalid", "Ugyldig eller utløpt invitasjon.", { rid });

    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      return jsonError(400, "invite_expired", "Invitasjonen er utløpt.", { rid });
    }

    const email = normEmail(invite.email);
    if (!email || !isEmail(email)) return jsonError(500, "invite_corrupt", "Invitasjonen mangler gyldig e-post.", { rid });

    const company_id = invite.company_id ? String(invite.company_id) : "";
    if (!company_id) return jsonError(500, "invite_corrupt", "Invitasjonen mangler company_id.", { rid });

    const location_id = invite.location_id ? String(invite.location_id) : null;
    const department = invite.department ?? null;

    const finalName = full_name ?? safeText(invite.full_name) ?? null;
    const displayName = finalName ?? email;
    const role = "employee";

    // 2) Opprett eller oppdater auth-bruker (metadata brukes av DB-trigger)
    let userId: string | null = null;

    const createRes = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role,
        company_id,
        location_id,
        department,
        full_name: finalName,
        name: displayName,
      },
    });

    if (createRes.error) {
      userId = await findUserIdByEmail(admin, email);
      if (!userId) return jsonError(500, "auth_error", "Kunne ikke opprette/finne bruker.", { rid, detail: createRes.error.message });

      const upd = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: {
          ...(createRes as any)?.data?.user?.user_metadata,
          role,
          company_id,
          location_id,
          department,
          full_name: finalName,
          name: displayName,
        },
      });

      if (upd.error) return jsonError(500, "auth_error", "Kunne ikke oppdatere bruker.", { rid, detail: upd.error.message });
    } else {
      userId = createRes.data.user?.id ? String(createRes.data.user.id) : null;
    }

    if (!userId) return jsonError(500, "auth_error", "Uventet: mangler userId.", { rid });

    // 3) Vent til profiles finnes (DB-trigger på auth.users)
    const profile = await waitForProfile(admin, userId);
    if (!profile) {
      return jsonError(
        500,
        "profile_not_created",
        "Profil ble ikke opprettet automatisk. Sjekk DB-trigger på auth.users → public.profiles.",
        { rid, userId }
      );
    }

    // 4) Sikkerhet: company_id må være satt av trigger, og matche invitasjonen
    if (!profile.company_id) {
      return jsonError(
        500,
        "profile_not_bound",
        "Profil ble opprettet, men er ikke knyttet til firma. Trigger må sette profiles.company_id ved INSERT.",
        { rid, userId }
      );
    }
    if (String(profile.company_id) !== company_id) {
      return jsonError(
        409,
        "company_mismatch",
        "Kontoen finnes allerede og er knyttet til et annet firma. Kontakt superadmin.",
        { rid, existingCompany: profile.company_id, inviteCompany: company_id }
      );
    }

    // 5) Oppdater kun trygge felter (IKKE company_id)
    const profUpd = await admin
      .from("profiles")
      .update({
        email,
        name: displayName,
        full_name: finalName,
        department,
        location_id,
        role,
        is_active: true,
        disabled_at: null,
        disabled_reason: null,
      })
      .eq("id", userId);

    if (profUpd.error) return jsonError(500, "db_error", "Kunne ikke oppdatere profil.", { rid, profUpd: profUpd.error });

    // 6) Marker invitasjon brukt
    const { error: useErr } = await admin
      .from("employee_invites")
      .update({ used_at: new Date().toISOString(), full_name: finalName ?? invite.full_name ?? null })
      .eq("id", invite.id)
      .is("used_at", null);

    if (useErr) return jsonError(500, "db_error", "Kunne ikke markere invitasjon brukt.", { rid, useErr });

    return NextResponse.json({ ok: true, rid, email }, { status: 200 });
  } catch (e: any) {
    return jsonError(500, "server_error", "Uventet feil.", { rid, message: String(e?.message ?? e) });
  }
}
