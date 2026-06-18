import "server-only";

import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getAuthContext, isProviderAuthRole } from "@/lib/auth/getAuthContext";
import { providerRoleSatisfies } from "@/lib/auth/provider";
import { jsonErr, makeRid } from "@/lib/http/respond";
import { isProviderRole, type ProviderRole } from "@/lib/providers/types";
import { opsLog } from "@/lib/ops/log";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function ridFromRequest(req: NextRequest): string {
  try {
    const fromHeader =
      safeStr(req.headers.get("x-rid")) ||
      safeStr(req.headers.get("x-request-id")) ||
      safeStr(req.headers.get("x-correlation-id"));
    if (fromHeader) return fromHeader;
  } catch {
    // ignore
  }
  return makeRid();
}

function logProviderCustomerAuthFailure(input: {
  rid: string;
  userId: string | null;
  email: string | null;
  companyId: string;
  customerProviderId: string | null;
  resolvedProviderId: string | null;
  providerRole: ProviderRole | null;
  failedGuard: string;
}) {
  opsLog("provider.customer.auth.denied", {
    rid: input.rid,
    user_id: input.userId,
    email: input.email,
    company_id: input.companyId,
    company_provider_id: input.customerProviderId,
    resolved_provider_id: input.resolvedProviderId,
    provider_role: input.providerRole,
    failed_guard: input.failedGuard,
  });
}

/**
 * Authoritative provider_admin check for provider customer API routes.
 * Session identity uses canonical getAuthContext (same as /leverandor/kunder).
 * Membership is read via admin client so RLS cannot false-negative valid admins.
 */
async function getProviderRoleAdmin(
  admin: SupabaseClient,
  userId: string,
  providerId: string
): Promise<ProviderRole | null> {
  const { data, error } = await admin
    .from("provider_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("provider_id", providerId)
    .maybeSingle();

  if (error || !data) return null;
  const role = safeStr((data as { role?: string }).role);
  return isProviderRole(role) ? role : null;
}

export type ProviderCustomerAdminAuth =
  | {
      ok: true;
      rid: string;
      userId: string;
      email: string | null;
      providerId: string;
      companyId: string;
      admin: SupabaseClient;
    }
  | { ok: false; res: Response };

export async function authorizeProviderCustomerAdmin(
  req: NextRequest,
  companyId: string,
  action: "restore" | "remove" | "agreement"
): Promise<ProviderCustomerAdminAuth> {
  const rid = ridFromRequest(req);
  const auth = await getAuthContext({ rid, reqHeaders: req.headers });

  const userId = safeStr(auth.userId);
  const email = auth.email ?? null;

  if (!auth.isAuthenticated || !userId) {
    return { ok: false, res: jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED") };
  }

  if (!isProviderAuthRole(auth.role)) {
    logProviderCustomerAuthFailure({
      rid,
      userId,
      email,
      companyId,
      customerProviderId: null,
      resolvedProviderId: null,
      providerRole: null,
      failedGuard: "PROVIDER_CONTEXT_MISSING",
    });
    return {
      ok: false,
      res: jsonErr(
        rid,
        "Fant ikke leverandørtilknytning for innlogget bruker.",
        403,
        "PROVIDER_CONTEXT_MISSING"
      ),
    };
  }

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = supabaseAdmin();

  const { data, error } = await admin.from("companies").select("id,provider_id").eq("id", companyId).maybeSingle();
  if (error || !data?.id) {
    return { ok: false, res: jsonErr(rid, "Fant ikke kunde.", 404, "NOT_FOUND") };
  }

  const providerId = safeStr((data as { provider_id?: string }).provider_id);
  if (!providerId) {
    logProviderCustomerAuthFailure({
      rid,
      userId,
      email,
      companyId,
      customerProviderId: null,
      resolvedProviderId: null,
      providerRole: null,
      failedGuard: "OUT_OF_SCOPE",
    });
    return {
      ok: false,
      res: jsonErr(rid, "Kunden er ikke koblet til leverandør.", 403, "OUT_OF_SCOPE"),
    };
  }

  const role = await getProviderRoleAdmin(admin, userId, providerId);
  if (!providerRoleSatisfies(role, "provider_admin")) {
    const code = role ? "PROVIDER_ROLE_MISSING" : "PROVIDER_ROLE_MISSING";
    const message =
      action === "restore"
        ? "Brukeren er ikke registrert som administrator for denne leverandøren."
        : "Brukeren er ikke registrert som administrator for denne leverandøren.";

    logProviderCustomerAuthFailure({
      rid,
      userId,
      email,
      companyId,
      customerProviderId: providerId,
      resolvedProviderId: providerId,
      providerRole: role,
      failedGuard: code,
    });

    return { ok: false, res: jsonErr(rid, message, 403, code) };
  }

  return {
    ok: true,
    rid,
    userId,
    email,
    providerId,
    companyId,
    admin,
  };
}
