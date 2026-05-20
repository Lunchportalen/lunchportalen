// lib/admin/suspend.ts — Patch 7 lifecycle RPC wrappers (server-only)
import "server-only";

import { supabaseServer } from "@/lib/supabase/server";

export class SuspendError extends Error {
  constructor(
    message: string,
    public readonly code: string | null | undefined,
  ) {
    super(message);
    this.name = "SuspendError";
  }
}

type LifecycleRpcResult = Record<string, unknown>;

async function callLifecycleRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<LifecycleRpcResult> {
  const supabase = await supabaseServer();
  const { data, error } = await (supabase as unknown as { rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }> }).rpc(
    fn,
    args,
  );

  if (error) {
    throw new SuspendError(error.message, error.code);
  }
  if (!data || typeof data !== "object") {
    throw new SuspendError(`${fn} returned no data`, null);
  }
  return data as LifecycleRpcResult;
}

export async function suspendProvider(providerId: string, reason: string) {
  return callLifecycleRpc("lp_provider_suspend", { p_provider_id: providerId, p_reason: reason });
}

export async function pauseProvider(providerId: string, reason?: string | null) {
  return callLifecycleRpc("lp_provider_pause", { p_provider_id: providerId, p_reason: reason ?? null });
}

export async function deleteProvider(providerId: string, reason: string) {
  return callLifecycleRpc("lp_provider_delete", { p_provider_id: providerId, p_reason: reason });
}

export async function resumeProvider(providerId: string) {
  return callLifecycleRpc("lp_provider_resume", { p_provider_id: providerId });
}

export async function suspendCompany(companyId: string, reason: string) {
  return callLifecycleRpc("lp_company_suspend", { p_company_id: companyId, p_reason: reason });
}

export async function pauseCompany(companyId: string, reason?: string | null) {
  return callLifecycleRpc("lp_company_pause", { p_company_id: companyId, p_reason: reason ?? null });
}

export async function deleteCompany(companyId: string, reason: string) {
  return callLifecycleRpc("lp_company_delete", { p_company_id: companyId, p_reason: reason });
}

export async function resumeCompany(companyId: string) {
  return callLifecycleRpc("lp_company_resume", { p_company_id: companyId });
}

export async function suspendUser(userId: string, reason: string) {
  return callLifecycleRpc("lp_user_suspend", { p_user_id: userId, p_reason: reason });
}

export async function pauseUser(userId: string) {
  return callLifecycleRpc("lp_user_pause", { p_user_id: userId });
}

export async function deleteUser(userId: string, reason: string, gdpr = false) {
  return callLifecycleRpc("lp_user_delete", {
    p_user_id: userId,
    p_reason: reason,
    p_gdpr: gdpr,
  });
}

export async function resumeUser(userId: string) {
  return callLifecycleRpc("lp_user_resume", { p_user_id: userId });
}
