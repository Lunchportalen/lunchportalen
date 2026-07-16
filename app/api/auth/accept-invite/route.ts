// app/api/auth/accept-invite/route.ts
// ✅ Oppdatert til ny FASIT:
// - profiles PK/FK er `id` (profiles_id_fkey -> auth.users.id)
// - IKKE upsert/insert profiles her (unngår FK-race). Profil skal opprettes av DB-trigger på auth.users.
// - Vi setter company_id/location_id/department/full_name i user_metadata ved create/update auth-user.
// - Venter til profiles-raden finnes (trigger), verifiserer at company_id er riktig, oppdaterer kun trygge felter.
// - Marker invite brukt til slutt.



export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "crypto";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function jsonError(rid: string, status: number, error: string, message: string, detail?: any) {
  const err = detail !== undefined ? { code: error, detail } : error;
  return jsonErr(rid, message, status, err);
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

async function findUserIdByEmail(admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>, email: string) {
  const listRes = await admin.auth.admin.listUsers({ perPage: 1000, page: 1 });
  const users = (listRes as any)?.data?.users as any[] | undefined;
  const hit = users?.find((u) => normEmail(u?.email) === email);
  return hit?.id ? String(hit.id) : null;
}

async function waitForProfile(admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>, userId: string) {
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
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const rid = makeRid();

  try {
    const body = await req.json().catch(() => ({}));

    const token = safeText(body?.token);
    const full_name = safeText(body?.full_name ?? body?.name);
    const password = String(body?.password ?? "");
    const password2 = String(body?.password2 ?? "");

    if (!token) return jsonError(rid, 400, "bad_request", "Mangler token.");
    if (!password || password.length < 10) return jsonError(rid, 400, "bad_request", "Passord må være minst 10 tegn.");
    if (password2 && password !== password2) return jsonError(rid, 400, "bad_request", "Passordene er ikke like.");

    const admin = supabaseAdmin();
    const token_hash = sha256Hex(token);

    // 1) Read the invite (peek only — canonical validation + consume happens
    //    atomically inside lp_employee_invite_accept). Fail-closed on lookup.
    const { data: invite, error: invErr } = await admin
      .from("employee_invites")
      .select("id, email, company_id, location_id, department, full_name, expires_at, used_at")
      .eq("token_hash", token_hash)
      .maybeSingle();

    if (invErr) return jsonError(rid, 500, "db_error", "Kunne ikke lese invitasjon.", invErr);
    if (!invite) return jsonError(rid, 400, "invite_invalid", "Ugyldig eller utløpt invitasjon.");

    const email = normEmail(invite.email);
    if (!email || !isEmail(email)) return jsonError(rid, 500, "invite_corrupt", "Invitasjonen mangler gyldig e-post.");

    const company_id = invite.company_id ? String(invite.company_id) : "";
    if (!company_id) return jsonError(rid, 500, "invite_corrupt", "Invitasjonen mangler company_id.");

    const location_id = invite.location_id ? String(invite.location_id) : null;
    const department = invite.department ?? null;

    const finalName = full_name ?? safeText(invite.full_name) ?? null;
    const displayName = finalName ?? email;
    const role = "employee";

    // 2) Create or update the auth user (auth-admin API; DB trigger seeds profile).
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
      if (!userId) return jsonError(rid, 500, "auth_error", "Kunne ikke opprette/finne bruker.", createRes.error.message);

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

      if (upd.error) return jsonError(rid, 500, "auth_error", "Kunne ikke oppdatere bruker.", upd.error.message);
    } else {
      userId = createRes.data.user?.id ? String(createRes.data.user.id) : null;
    }

    if (!userId) return jsonError(rid, 500, "auth_error", "Uventet: mangler userId.");

    // 3) Wait for the profile row (trigger on auth.users → public.profiles).
    const profile = await waitForProfile(admin, userId);
    if (!profile) {
      return jsonError(rid, 500, "profile_not_created", "Profil ble ikke opprettet automatisk. Sjekk DB-trigger på auth.users → public.profiles.", { userId });
    }

    // 4) CANONICAL atomic accept: profile bind + membership sync + invite consume
    //    in one transaction, idempotent, fail-closed (expired/used/wrong-tenant).
    const { data: acceptData, error: acceptErr } = await admin.rpc("lp_employee_invite_accept", {
      p_user_id: userId,
      p_token_hash: token_hash,
      p_email: email,
      p_full_name: finalName,
    });

    if (acceptErr) {
      const raw = String(acceptErr.message ?? "").toUpperCase();
      if (raw.includes("INVITE_EXPIRED")) return jsonError(rid, 400, "invite_expired", "Invitasjonen er utløpt.");
      if (raw.includes("INVITE_USED")) return jsonError(rid, 409, "invite_used", "Invitasjonen er allerede brukt.");
      if (raw.includes("INVITE_EMAIL_MISMATCH")) return jsonError(rid, 409, "invite_email_mismatch", "Invitasjonen tilhører en annen e-postadresse.");
      if (raw.includes("COMPANY_MISMATCH")) {
        return jsonError(rid, 409, "company_mismatch", "Kontoen finnes allerede og er knyttet til et annet firma. Kontakt superadmin.");
      }
      if (raw.includes("INVITE_INVALID") || raw.includes("INVITE_CORRUPT")) {
        return jsonError(rid, 400, "invite_invalid", "Ugyldig eller utløpt invitasjon.");
      }
      return jsonError(rid, 500, "accept_failed", "Kunne ikke fullføre invitasjonen.", { detail: acceptErr.message });
    }

    // Audit (no PII: pseudonymous ids, no email/password).
    try {
      const { auditLog } = await import("@/lib/audit/log");
      auditLog({
        action: "INVITE_ACCEPTED",
        userId,
        role: "employee",
        companyId: company_id,
        locationId: location_id,
        resource: "employee_invite",
        resourceId: String(invite.id),
        metadata: { rid, idempotent: Boolean((acceptData as { idempotent?: boolean } | null)?.idempotent) },
        timestamp: Date.now(),
        rid,
      });
    } catch {
      // audit must never break acceptance
    }

    return jsonOk(rid, { ok: true, rid, email }, 200);
  } catch (e: any) {
    return jsonError(rid, 500, "server_error", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}

