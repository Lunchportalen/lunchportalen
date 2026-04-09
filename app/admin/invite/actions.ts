"use server";

import "server-only";

import { computeRole, hasRole, type Role } from "@/lib/auth/roles";
import { getRoleForUser } from "@/lib/auth/getRoleForUser";
import { createEmployeeSingleInvite, normInviteEmail } from "@/lib/invites/createEmployeeSingleInvite";
import { getPublicAppUrlFromEnv } from "@/lib/invites/employeeInviteUrl";
import { supabaseServer } from "@/lib/supabase/server";

export type CreateEmployeeInviteActionResult =
  | { ok: true; inviteUrl: string; inviteId: string | null; emailSent: boolean; emailError?: string }
  | { ok: false; message: string; code?: string };

function pickUserId(u: { id?: string } | null | undefined) {
  return String(u?.id ?? "").trim();
}

export async function createEmployeeInvite(email: string): Promise<CreateEmployeeInviteActionResult> {
  const sb = await supabaseServer();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  const user = auth?.user ?? null;
  const userId = pickUserId(user);

  if (authErr || !userId) {
    return { ok: false, message: "Ikke innlogget.", code: "UNAUTHENTICATED" };
  }

  let profileRole: unknown = null;
  try {
    profileRole = await getRoleForUser(userId);
  } catch {
    profileRole = null;
  }

  const role: Role = computeRole(user, profileRole as any);
  if (!hasRole(role, ["company_admin"])) {
    return { ok: false, message: "Kun firmadmin kan invitere ansatte.", code: "FORBIDDEN" };
  }

  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("company_id, location_id")
    .or(`id.eq.${userId},user_id.eq.${userId}`)
    .maybeSingle();

  if (pErr || !profile?.company_id) {
    return { ok: false, message: "Mangler firmatilknytning.", code: "MISSING_COMPANY" };
  }

  const companyId = String(profile.company_id).trim();
  const locationId = profile.location_id ? String(profile.location_id).trim() : null;

  const res = await createEmployeeSingleInvite({
    companyId,
    actorUserId: userId,
    actorEmail: user?.email ?? null,
    actorLocationId: locationId,
    emailRaw: normInviteEmail(email),
    appBaseUrl: getPublicAppUrlFromEnv(),
  });

  if (res.ok === false) {
    return { ok: false, message: res.message, code: res.code };
  }

  return {
    ok: true,
    inviteUrl: res.inviteUrl,
    inviteId: res.inviteId,
    emailSent: res.emailSent,
    emailError: res.emailError,
  };
}
