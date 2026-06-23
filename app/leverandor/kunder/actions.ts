"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import {
  deleteCompany,
  pauseCompany,
  resumeCompany,
  SuspendError,
  suspendCompany,
} from "@/lib/admin/suspend";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import {
  customerActionFailure,
  type ProviderCustomerActionErrorKey,
} from "@/lib/providers/providerCustomerActionErrors";
import { validateLifecycleReason } from "@/lib/providers/lifecycleReason";
import { supabaseServer } from "@/lib/supabase/server";

export type CustomerActionResult =
  | { success: true; cascade_orders_paused?: number }
  | { success: false; errorKey: ProviderCustomerActionErrorKey };

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function rpcCascade(result: Record<string, unknown>): number | undefined {
  const n = result.cascade_orders_paused;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

async function resolveCompanyProvider(
  companyId: string,
): Promise<{ providerId: string } | { success: false; errorKey: ProviderCustomerActionErrorKey }> {
  const cid = safeStr(companyId);
  if (!cid) return customerActionFailure("invalidCustomer");

  const sb = await supabaseServer();
  const { data, error } = await sb.from("companies").select("provider_id").eq("id", cid).maybeSingle();
  if (error || !data?.provider_id) return customerActionFailure("customerNotFound");

  return { providerId: safeStr(data.provider_id) };
}

async function assertProviderAdminForCompany(companyId: string): Promise<
  | { ok: true; userId: string; providerId: string }
  | { success: false; errorKey: ProviderCustomerActionErrorKey }
> {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    return customerActionFailure("notAuthenticated");
  }

  const resolved = await resolveCompanyProvider(companyId);
  if ("success" in resolved) return resolved;

  const allowed = await hasProviderRole(auth.user.id, resolved.providerId, "provider_admin");
  if (!allowed) return customerActionFailure("providerAdminRequired");

  return { ok: true, userId: auth.user.id, providerId: resolved.providerId };
}

function revalidateCustomer(companyId: string) {
  revalidatePath("/leverandor/kunder");
  revalidatePath(`/leverandor/kunder/${companyId}`);
  revalidatePath("/leverandor");
}

export async function suspendCustomer(companyId: string, reason: string): Promise<CustomerActionResult> {
  const gate = await assertProviderAdminForCompany(companyId);
  if (!("ok" in gate)) return gate;

  const reasonErr = validateLifecycleReason(reason);
  if (reasonErr) return customerActionFailure("reasonTooShort");

  try {
    const result = await suspendCompany(companyId, reason.trim());
    revalidateCustomer(companyId);
    return { success: true, cascade_orders_paused: rpcCascade(result) };
  } catch (e) {
    if (e instanceof SuspendError) return customerActionFailure("updateFailed");
    return customerActionFailure("unknown");
  }
}

export async function pauseCustomer(companyId: string, reason: string): Promise<CustomerActionResult> {
  const gate = await assertProviderAdminForCompany(companyId);
  if (!("ok" in gate)) return gate;

  const reasonErr = validateLifecycleReason(reason);
  if (reasonErr) return customerActionFailure("reasonTooShort");

  try {
    const result = await pauseCompany(companyId, reason.trim());
    revalidateCustomer(companyId);
    return { success: true, cascade_orders_paused: rpcCascade(result) };
  } catch (e) {
    if (e instanceof SuspendError) return customerActionFailure("updateFailed");
    return customerActionFailure("unknown");
  }
}

export async function deleteCustomer(companyId: string, reason: string): Promise<CustomerActionResult> {
  const gate = await assertProviderAdminForCompany(companyId);
  if (!("ok" in gate)) return gate;

  const reasonErr = validateLifecycleReason(reason);
  if (reasonErr) return customerActionFailure("reasonTooShort");

  try {
    const result = await deleteCompany(companyId, reason.trim());
    revalidateCustomer(companyId);
    return { success: true, cascade_orders_paused: rpcCascade(result) };
  } catch (e) {
    if (e instanceof SuspendError) return customerActionFailure("removeFailed");
    return customerActionFailure("unknown");
  }
}

export async function resumeCustomer(companyId: string): Promise<CustomerActionResult> {
  const gate = await assertProviderAdminForCompany(companyId);
  if (!("ok" in gate)) return gate;

  try {
    await resumeCompany(companyId);
    revalidateCustomer(companyId);
    return { success: true };
  } catch (e) {
    if (e instanceof SuspendError) return customerActionFailure("restoreFailed");
    return customerActionFailure("unknown");
  }
}
