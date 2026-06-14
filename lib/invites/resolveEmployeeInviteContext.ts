import "server-only";

import crypto from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type EmployeeInviteContextOk = {
  ok: true;
  email: string;
  companyName: string;
  providerName: string;
  locationName: string;
};

export type EmployeeInviteContextErr = {
  ok: false;
};

export type EmployeeInviteContext = EmployeeInviteContextOk | EmployeeInviteContextErr;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function resolveEmployeeInviteContext(token: string): Promise<EmployeeInviteContext> {
  const tokenHash = hashToken(safeStr(token));
  if (!token) return { ok: false };

  const admin: any = supabaseAdmin();
  const { data: invite, error } = await admin
    .from("employee_invites")
    .select("email, expires_at, used_at, companies:company_id(name, provider_id), company_locations:location_id(name)")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !invite) return { ok: false };
  if (invite.used_at) return { ok: false };
  if (!invite.expires_at || new Date(invite.expires_at).getTime() <= Date.now()) return { ok: false };

  const email = safeStr(invite.email).toLowerCase();
  if (!email) return { ok: false };

  const companyName = safeStr(invite.companies?.name);
  const providerId = safeStr(invite.companies?.provider_id);
  const locationName = safeStr(invite.company_locations?.name);

  let providerName = "";
  if (providerId) {
    const { data: providerRow } = await admin.from("providers").select("name").eq("id", providerId).maybeSingle();
    providerName = safeStr(providerRow?.name);
  }

  return {
    ok: true,
    email,
    companyName,
    providerName,
    locationName,
  };
}
