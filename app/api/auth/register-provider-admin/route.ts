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
  return ((users.data?.users ?? []) as any[]).find((u) => normEmail(u?.email) === email) ?? null;
}

export async function POST(req: NextRequest) {
  const rid = makeRid("provider_admin_register");

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

    // Peek only — canonical validation + consume is atomic in the RPC.
    const { data: invite, error: invErr } = await (admin as any)
      .from("provider_invites")
      .select("id, provider_id, email, full_name")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (invErr) return jsonErr(rid, "Kunne ikke verifisere invitasjon.", 500, "INVITE_LOOKUP_FAILED");
    if (!invite) return jsonErr(rid, "Ugyldig invitasjon.", 400, "INVALID_INVITE");

    const email = normEmail(invite.email);
    const fullName = requestedName || safeStr(invite.full_name) || email;
    if (!email) return jsonErr(rid, "Invitasjonen mangler e-post.", 500, "INVITE_CORRUPT");

    let userId: string | null = null;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "provider_admin", full_name: fullName, name: fullName },
    });
    if (created.error) {
      const existing = await findAuthUserByEmail(admin, email);
      if (!existing?.id) return jsonErr(rid, "Kunne ikke opprette brukerkonto.", 500, "AUTH_CREATE_FAILED");
      userId = String(existing.id);
      const updated = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { ...(existing.user_metadata ?? {}), role: "provider_admin", full_name: fullName, name: fullName },
      });
      if (updated.error) return jsonErr(rid, "Kunne ikke oppdatere brukerkonto.", 500, "AUTH_UPDATE_FAILED");
    } else {
      userId = created.data.user?.id ? String(created.data.user.id) : null;
    }
    if (!userId) return jsonErr(rid, "Kunne ikke bekrefte brukerkonto.", 500, "AUTH_USER_MISSING");

    // Wait for the profile row (trigger on auth.users) before the atomic bind.
    let profileReady = false;
    for (let i = 0; i < 25; i += 1) {
      const { data: p } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
      if (p?.id) {
        profileReady = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!profileReady) return jsonErr(rid, "Profil ble ikke opprettet automatisk.", 500, "PROFILE_NOT_CREATED");

    const { data: acceptData, error: acceptErr } = await (admin as any).rpc("lp_provider_admin_invite_accept", {
      p_user_id: userId,
      p_token_hash: tokenHash,
      p_email: email,
      p_full_name: fullName,
    });
    if (acceptErr) {
      const raw = String(acceptErr.message ?? "").toUpperCase();
      if (raw.includes("INVITE_EXPIRED")) return jsonErr(rid, "Invitasjonen er utløpt.", 400, "INVITE_EXPIRED");
      if (raw.includes("INVITE_REVOKED")) return jsonErr(rid, "Invitasjonen er trukket tilbake.", 409, "INVITE_REVOKED");
      if (raw.includes("INVITE_USED")) return jsonErr(rid, "Invitasjonen er allerede brukt.", 409, "INVITE_USED");
      if (raw.includes("INVITE_EMAIL_MISMATCH")) return jsonErr(rid, "Invitasjonen tilhører en annen e-postadresse.", 409, "INVITE_EMAIL_MISMATCH");
      if (raw.includes("INVITE_INVALID")) return jsonErr(rid, "Ugyldig invitasjon.", 400, "INVALID_INVITE");
      return jsonErr(rid, "Kunne ikke fullføre invitasjonen.", 500, "ACCEPT_FAILED");
    }

    const providerId = (acceptData as { provider_id?: string } | null)?.provider_id ?? null;

    try {
      const { auditLog } = await import("@/lib/audit/log");
      auditLog({
        action: "PROVIDER_INVITE_ACCEPTED",
        userId,
        role: "provider_admin",
        companyId: null,
        locationId: null,
        resource: "provider_invite",
        resourceId: String(invite.id),
        metadata: { rid, providerId, idempotent: Boolean((acceptData as { idempotent?: boolean } | null)?.idempotent) },
        timestamp: Date.now(),
        rid,
      });
    } catch {
      // audit must never break acceptance
    }

    return jsonOk(rid, { email, userId, providerId }, 200);
  } catch {
    return jsonErr(rid, "Uventet feil.", 500, "REGISTER_PROVIDER_ADMIN_UNEXPECTED");
  }
}
