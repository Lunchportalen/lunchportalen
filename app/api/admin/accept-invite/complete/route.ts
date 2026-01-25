// app/api/accept-invite/complete/route.ts
// ✅ FASIT:
// - profiles PK/FK er `id` (profiles_id_fkey -> auth.users.id)
// - IKKE insert/upsert profiles her (unngår FK-race). Profil skal opprettes av DB-trigger på auth.users.
// - Vi setter company_id/location_id/department/full_name i user_metadata ved create/update auth-user.
// - Vi venter til profiles-raden finnes.
// - Vi oppdaterer kun “trygge felter” (IKKE company_id).
// - Marker invite brukt til slutt.
// - BONUS: idempotent/race-safe og mer robuste feilmeldinger (RID).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}
function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}

function safeText(v: any, max = 120) {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
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

async function safeDeleteAuthUser(admin: ReturnType<typeof supabaseAdmin>, userId: string) {
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch {}
}

async function listAuthUsers(admin: ReturnType<typeof supabaseAdmin>) {
  const res = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const users = (res as any)?.data?.users as any[] | undefined;
  return users ?? [];
}

async function findAuthUserByEmail(admin: ReturnType<typeof supabaseAdmin>, email: string) {
  const users = await listAuthUsers(admin);
  return users.find((u) => normEmail(u?.email) === email) ?? null;
}

async function waitForAuthUserId(admin: ReturnType<typeof supabaseAdmin>, email: string) {
  const maxRetries = 15; // ~3s
  const sleepMs = 200;
  for (let i = 0; i < maxRetries; i++) {
    const u = await findAuthUserByEmail(admin, email);
    if (u?.id) return String(u.id);
    await new Promise((r) => setTimeout(r, sleepMs));
  }
  return null;
}

async function waitForProfile(admin: ReturnType<typeof supabaseAdmin>, userId: string) {
  const maxRetries = 30; // ~6s
  const sleepMs = 200;

  for (let i = 0; i < maxRetries; i++) {
    const { data, error } = await admin.from("profiles").select("id, company_id").eq("id", userId).maybeSingle();
    if (!error && data?.id) return data as { id: string; company_id: string | null };
    await new Promise((r) => setTimeout(r, sleepMs));
  }
  return null;
}

export async function POST(req: Request) {
  const rid = `accept_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const body = await req.json().catch(() => ({}));

    const token = String(body.token ?? "").trim();
    const password = String(body.password ?? "");
    const password2 = String(body.password2 ?? "");
    const nameInput = safeText(body.name ?? body.full_name ?? body.fullName, 120);

    if (!token) return jsonError(400, "missing_token", "Mangler token.", { rid });
    if (!password || password.length < 10) return jsonError(400, "bad_password", "Passord må være minst 10 tegn.", { rid });
    if (password2 && password !== password2) return jsonError(400, "pw_mismatch", "Passordene er ikke like.", { rid });

    const admin = supabaseAdmin();
    const token_hash = sha256Hex(token);
    const nowIso = new Date().toISOString();

    // 1) Finn gyldig invite (ubrukt + ikke utløpt)
    // NB: idempotent: vi bruker used_at gate under markeringen, men her sjekker vi at den ikke er brukt allerede.
    const inv = await admin
      .from("employee_invites")
      .select("id, email, company_id, location_id, department, full_name, expires_at, used_at")
      .eq("token_hash", token_hash)
      .gt("expires_at", nowIso)
      .maybeSingle();

    if (inv.error) return jsonError(500, "invite_lookup_failed", "Kunne ikke verifisere invitasjon.", { rid, detail: inv.error });
    if (!inv.data) return jsonError(400, "invalid_token", "Ugyldig eller utløpt invitasjon.", { rid });
    if (inv.data.used_at) return jsonError(400, "already_used", "Invitasjonen er allerede brukt.", { rid });

    const email = normEmail(inv.data.email);
    if (!email || !isEmail(email)) return jsonError(400, "invalid_email", "Ugyldig e-post på invitasjonen.", { rid });

    const company_id = inv.data.company_id ? String(inv.data.company_id) : "";
    if (!company_id) return jsonError(500, "invite_corrupt", "Invitasjonen mangler company_id.", { rid });

    const location_id = inv.data.location_id ? String(inv.data.location_id) : null;
    const department = inv.data.department ?? null;
    const inviteFullName = inv.data.full_name ?? null;

    const full_name =
      nameInput?.trim()
        ? nameInput.trim()
        : inviteFullName && String(inviteFullName).trim()
          ? String(inviteFullName).trim()
          : null;

    const displayName = full_name || email;

    // 2) Opprett/oppdater auth-user (idempotent) med metadata som DB-trigger bruker til å lage profiles-raden riktig.
    let createdNewAuthUser = false;

    const create = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "employee",
        company_id,
        location_id,
        department,
        full_name,
        name: displayName,
      },
    });

    if (!create.error) {
      createdNewAuthUser = true;
    } else {
      const existing = await findAuthUserByEmail(admin, email);
      if (!existing?.id) {
        return jsonError(500, "auth_user_lookup_failed", "Kunne ikke opprette eller finne brukerkonto.", {
          rid,
          detail: create.error.message,
        });
      }

      const upd = await admin.auth.admin.updateUserById(String(existing.id), {
        password,
        user_metadata: {
          ...(existing.user_metadata ?? {}),
          role: "employee",
          company_id,
          location_id,
          department,
          full_name,
          name: displayName,
        },
      });

      if (upd.error) return jsonError(500, "auth_update_failed", "Kunne ikke oppdatere konto.", { rid, detail: upd.error.message });
    }

    // 3) Hent userId og vent til profiles finnes (DB-trigger)
    const userId = await waitForAuthUserId(admin, email);
    if (!userId) {
      if (createdNewAuthUser) {
        const u = await findAuthUserByEmail(admin, email);
        if (u?.id) await safeDeleteAuthUser(admin, String(u.id));
      }
      return jsonError(500, "auth_not_ready", "Kunne ikke bekrefte bruker i auth.", { rid });
    }

    const profile = await waitForProfile(admin, userId);
    if (!profile) {
      return jsonError(
        500,
        "profile_not_created",
        "Profil ble ikke opprettet automatisk. Sjekk DB-trigger på auth.users → public.profiles.",
        { rid, userId }
      );
    }

    // 4) Sikkerhet: company_id skal være bundet via trigger (ikke via update her)
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

    // 5) Oppdater trygge felt i profiles (IKKE company_id)
    const profUpd = await admin
      .from("profiles")
      .update({
        email,
        full_name: full_name ?? inviteFullName ?? null,
        name: displayName,
        department,
        location_id,
        role: "employee",
        is_active: true,
        disabled_at: null,
        disabled_reason: null,
      })
      .eq("id", userId);

    if (profUpd.error) {
      return jsonError(500, "profile_update_failed", "Kunne ikke oppdatere profil.", { rid, detail: profUpd.error });
    }

    // 6) Marker invitasjon brukt (race-safe)
    // NB: .is("used_at", null) hindrer at vi overskriver i race
    const mark = await admin
      .from("employee_invites")
      .update({ used_at: nowIso })
      .eq("id", inv.data.id)
      .is("used_at", null);

    if (mark.error) {
      return jsonOk({
        ok: true,
        rid,
        message: "Konto opprettet, men kunne ikke markere invitasjon brukt.",
        warning: mark.error,
      });
    }

    // Hvis race: oppdaterte 0 rader (brukes allerede) — returner ok (idempotent)
    // (PostgREST returnerer typisk ikke rowcount uten select; vi holder det enkelt.)

    return jsonOk({ ok: true, rid, message: "Konto opprettet." });
  } catch (e: any) {
    return jsonError(500, "server_error", "Uventet feil.", { rid, detail: String(e?.message ?? e) });
  }
}

export async function GET() {
  return jsonError(405, "method_not_allowed", "Bruk POST for å fullføre invitasjon.");
}
