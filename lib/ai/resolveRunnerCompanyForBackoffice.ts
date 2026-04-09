import "server-only";

import type { AuthContext } from "@/lib/auth/getAuthContext";
import { planAllowsAi } from "@/lib/ai/entitlements";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Resolves a companyId for AI runner logging + entitlements.
 * Prefer the authenticated profile company; for superadmin without company, pick one
 * deterministic company row that has an AI-eligible plan (fail-closed if none).
 */
export async function resolveRunnerCompanyIdForBackoffice(auth: AuthContext): Promise<string | null> {
  const fromProfile = typeof auth.company_id === "string" ? auth.company_id.trim() : "";
  if (fromProfile) {
    return fromProfile;
  }

  if (auth.role !== "superadmin") {
    return null;
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("companies").select("id, saas_plan").order("created_at", { ascending: true });

  if (error || !Array.isArray(data)) {
    return null;
  }

  for (const row of data) {
    const id = typeof row?.id === "string" ? row.id.trim() : "";
    const plan = typeof row?.saas_plan === "string" ? row.saas_plan : "none";
    if (id && planAllowsAi(plan)) {
      return id;
    }
  }

  return null;
}
