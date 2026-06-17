import "server-only";

import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { providerRoleSatisfies } from "@/lib/auth/provider";
import { jsonErr } from "@/lib/http/respond";
import { scopeOr401 } from "@/lib/http/routeGuard";
import { isProviderRole, type ProviderRole } from "@/lib/providers/types";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid?: string } }): Response {
  if (s?.response) return s.response;
  if (s?.res) return s.res;
  return jsonErr(String(s?.ctx?.rid ?? "rid_missing"), "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

/**
 * Authoritative provider_admin check for provider customer API routes.
 * Session identity comes from scopeOr401; membership is read via admin client
 * so RLS/auth.uid() drift in route handlers cannot false-negative valid admins.
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
  action: "restore" | "remove"
): Promise<ProviderCustomerAdminAuth> {
  const gate = await scopeOr401(req);
  if (!gate.ok) return { ok: false, res: denyResponse(gate) };

  const userId = safeStr(gate.ctx.scope.userId);
  if (!userId) {
    return { ok: false, res: jsonErr(gate.ctx.rid, "Ikke innlogget.", 401, "UNAUTHORIZED") };
  }

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = supabaseAdmin();

  const { data, error } = await admin.from("companies").select("id,provider_id").eq("id", companyId).maybeSingle();
  if (error || !data?.id) {
    return { ok: false, res: jsonErr(gate.ctx.rid, "Fant ikke kunde.", 404, "NOT_FOUND") };
  }

  const providerId = safeStr((data as { provider_id?: string }).provider_id);
  if (!providerId) {
    return {
      ok: false,
      res: jsonErr(gate.ctx.rid, "Kunden er ikke koblet til leverandør.", 403, "FORBIDDEN"),
    };
  }

  const role = await getProviderRoleAdmin(admin, userId, providerId);
  if (!providerRoleSatisfies(role, "provider_admin")) {
    const message =
      action === "restore"
        ? "Du har ikke tilgang til å gjenopprette denne kunden."
        : "Du har ikke tilgang til å fjerne denne kunden.";
    return { ok: false, res: jsonErr(gate.ctx.rid, message, 403, "FORBIDDEN") };
  }

  return {
    ok: true,
    rid: gate.ctx.rid,
    userId,
    email: gate.ctx.scope.email ?? null,
    providerId,
    companyId,
    admin,
  };
}
