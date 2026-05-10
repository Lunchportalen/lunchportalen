export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import crypto from "node:crypto";
import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function normEmail(value: unknown) {
  return safeStr(value).toLowerCase();
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function findAuthUserByEmail(admin: ReturnType<typeof supabaseAdmin>, email: string) {
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return ((users.data?.users ?? []) as any[]).find((user) => normEmail(user?.email) === email) ?? null;
}

export async function POST(req: NextRequest) {
  const rid = makeRid("company_admin_register");

  try {
    const body = await req.json().catch(() => null);
    const token = safeStr(body?.token);
    const password = safeStr(body?.password);
    const password2 = safeStr(body?.password2);
    const requestedName = safeStr(body?.name);

    if (!token) return jsonErr(rid, "Mangler token.", 400, "MISSING_TOKEN");
    if (!password || password.length < 10) return jsonErr(rid, "Passord må være minst 10 tegn.", 400, "WEAK_PASSWORD");
    if (password !== password2) return jsonErr(rid, "Passordene er ikke like.", 400, "PASSWORD_MISMATCH");

    const admin = supabaseAdmin();
    const tokenHash = hashToken(token);
    const { data: invite, error: inviteErr } = await (admin as any)
      .from("company_invites")
      .select("id, company_id, contact_email, contact_name, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (inviteErr) return jsonErr(rid, "Kunne ikke verifisere invitasjon.", 500, "INVITE_LOOKUP_FAILED");
    if (!invite) return jsonErr(rid, "Ugyldig invitasjon.", 400, "INVALID_INVITE");
    if (invite.used_at) return jsonErr(rid, "Invitasjonen er allerede brukt.", 409, "INVITE_USED");
    if (!invite.expires_at || new Date(invite.expires_at).getTime() <= Date.now()) {
      return jsonErr(rid, "Invitasjonen er utløpt.", 400, "INVITE_EXPIRED");
    }

    const email = normEmail(invite.contact_email);
    const companyId = safeStr(invite.company_id);
    const fullName = requestedName || safeStr(invite.contact_name) || email;
    if (!email || !companyId) return jsonErr(rid, "Invitasjonen mangler firma eller e-post.", 500, "INVITE_CORRUPT");

    let userId: string | null = null;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "company_admin",
        company_id: companyId,
        full_name: fullName,
        name: fullName,
      },
    });

    if (created.error) {
      const existing = await findAuthUserByEmail(admin, email);
      if (!existing?.id) return jsonErr(rid, "Kunne ikke opprette brukerkonto.", 500, "AUTH_CREATE_FAILED");
      userId = String(existing.id);
      const updated = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: {
          ...(existing.user_metadata ?? {}),
          role: "company_admin",
          company_id: companyId,
          full_name: fullName,
          name: fullName,
        },
      });
      if (updated.error) return jsonErr(rid, "Kunne ikke oppdatere brukerkonto.", 500, "AUTH_UPDATE_FAILED");
    } else {
      userId = created.data.user?.id ? String(created.data.user.id) : null;
    }

    if (!userId) return jsonErr(rid, "Kunne ikke bekrefte brukerkonto.", 500, "AUTH_USER_MISSING");

    const { data: existingProfile, error: profileReadErr } = await admin
      .from("profiles")
      .select("id, company_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileReadErr) return jsonErr(rid, "Kunne ikke lese profil.", 500, "PROFILE_READ_FAILED");
    if (existingProfile?.company_id && String(existingProfile.company_id) !== companyId) {
      return jsonErr(rid, "Kontoen er allerede knyttet til et annet firma.", 409, "COMPANY_MISMATCH");
    }

    const profilePayload = {
      id: userId,
      email,
      full_name: fullName,
      role: "company_admin",
      company_id: companyId,
      active: true,
      is_active: true,
      disabled_at: null,
      updated_at: new Date().toISOString(),
    };

    const profileWrite = existingProfile
      ? await admin.from("profiles").update(profilePayload).eq("id", userId)
      : await admin.from("profiles").insert(profilePayload);
    if (profileWrite.error) return jsonErr(rid, "Kunne ikke lagre profil.", 500, "PROFILE_WRITE_FAILED");

    const nowIso = new Date().toISOString();
    const mark = await (admin as any)
      .from("company_invites")
      .update({ used_at: nowIso, accepted_at: nowIso })
      .eq("id", invite.id)
      .is("used_at", null);
    if (mark.error) return jsonErr(rid, "Konto opprettet, men invitasjonen kunne ikke markeres brukt.", 500, "INVITE_MARK_FAILED");

    return jsonOk(rid, { email, userId, companyId }, 200);
  } catch {
    return jsonErr(rid, "Uventet feil.", 500, "REGISTER_COMPANY_ADMIN_UNEXPECTED");
  }
}
