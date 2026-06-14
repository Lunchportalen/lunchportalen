import "server-only";

import { supabaseServer } from "@/lib/supabase/server";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export type DashboardCompanyMeta = {
  providerName: string | null;
  ehfEnabled: boolean;
};

/** Read-only company meta for admin dashboard — provider + billing flags. */
export async function loadDashboardCompanyMeta(companyId: string): Promise<DashboardCompanyMeta> {
  try {
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("companies")
      .select("provider_id, ehf_enabled")
      .eq("id", companyId)
      .maybeSingle();

    if (error || !data) {
      return { providerName: null, ehfEnabled: false };
    }

    const providerId = safeStr((data as { provider_id?: unknown }).provider_id);
    const ehfEnabled = Boolean((data as { ehf_enabled?: unknown }).ehf_enabled);

    if (!providerId) {
      return { providerName: null, ehfEnabled };
    }

    const { data: providerRow } = await sb.from("providers").select("name").eq("id", providerId).maybeSingle();
    const providerName = safeStr((providerRow as { name?: unknown } | null)?.name) || null;

    return { providerName, ehfEnabled };
  } catch {
    return { providerName: null, ehfEnabled: false };
  }
}
