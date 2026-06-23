"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import {
  mapRegistrationRpcErrorKey,
  registrationActionFailure,
  type ProviderRegistrationActionErrorKey,
} from "@/lib/providers/providerRegistrationActionErrors";
import { supabaseServer } from "@/lib/supabase/server";

export type RegistrationActionResult =
  | { success: true; companyId?: string; agreementId?: string }
  | { success: false; errorKey: ProviderRegistrationActionErrorKey };

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

async function assertProviderAdmin(providerId: string) {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    return { ok: false as const, errorKey: "notAuthenticated" as const };
  }

  const allowed = await hasProviderRole(auth.user.id, providerId, "provider_admin");
  if (!allowed) {
    return { ok: false as const, errorKey: "providerAdminRequired" as const };
  }

  return { ok: true as const, userId: auth.user.id };
}

export async function approveProviderRegistration(
  providerId: string,
  registrationId: string,
  tier: "BASIS" | "LUXUS",
): Promise<RegistrationActionResult> {
  const gate = await assertProviderAdmin(providerId);
  if (!gate.ok) return registrationActionFailure(gate.errorKey);

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("lp_company_registration_approve_provider", {
    p_registration_id: registrationId,
    p_agreement_tier: tier,
  });

  if (error) {
    const key = mapRegistrationRpcErrorKey(error.message);
    return registrationActionFailure(key === "actionFailed" ? "approveFailed" : key);
  }

  const row = (data ?? {}) as Record<string, unknown>;
  revalidatePath("/leverandor/registreringer");
  revalidatePath("/leverandor/kunder");
  return {
    success: true,
    companyId: safeStr(row.company_id) || undefined,
    agreementId: safeStr(row.agreement_id) || undefined,
  };
}

export async function rejectProviderRegistration(
  providerId: string,
  registrationId: string,
  reason: string,
): Promise<RegistrationActionResult> {
  const gate = await assertProviderAdmin(providerId);
  if (!gate.ok) return registrationActionFailure(gate.errorKey);

  const trimmed = safeStr(reason);
  if (trimmed.length < 3) return registrationActionFailure("rejectReasonRequired");

  const sb = await supabaseServer();
  const { error } = await sb.rpc("lp_company_registration_reject_provider", {
    p_registration_id: registrationId,
    p_reason: trimmed,
  });

  if (error) {
    const key = mapRegistrationRpcErrorKey(error.message);
    return registrationActionFailure(key === "actionFailed" ? "rejectFailed" : key);
  }

  revalidatePath("/leverandor/registreringer");
  return { success: true };
}

export async function getProviderIdForActions(): Promise<string | null> {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) return null;
  const ctx = await getProviderAdminContext(auth.user.id);
  return ctx.primaryProvider?.id ?? null;
}
