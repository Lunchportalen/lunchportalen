import "server-only";

import { hasProviderRole } from "@/lib/auth/provider";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { resolveTripletexProviderEnv } from "@/lib/integrations/tripletex/resolveTripletexProviderEnv";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export type ProviderConnectionState = {
  state: string;
  provisioningComplete: boolean;
  companyName: string | null;
};

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

export async function loadProviderConnectionState(
  providerId: string,
): Promise<ProviderConnectionState | null> {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) return null;

  const allowed = await hasProviderRole(auth.user.id, providerId, "provider_admin");
  if (!allowed) return null;

  const env = resolveTripletexProviderEnv();
  const sb = await supabaseServer();
  const { data: health, error } = await sb.rpc("lp_provider_get_connection_health", {
    p_provider_id: providerId,
    p_env: env,
  });

  if (error) return null;

  const admin = supabaseAdmin();
  const { data: credRow } = await admin
    .from("provider_tripletex_credentials")
    .select("onboarding_provisioning_complete_at")
    .eq("provider_id", providerId)
    .maybeSingle();

  const h = (health ?? {}) as Record<string, unknown>;

  return {
    state: safeStr(h.state) || "NOT_CONNECTED",
    provisioningComplete: Boolean(credRow?.onboarding_provisioning_complete_at),
    companyName: safeStr(h.tripletex_company_name) || null,
  };
}
