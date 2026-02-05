// lib/guards/assertCompanyActive.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type CompanyStatus = "active" | "paused" | "closed";

export async function assertCompanyActive(
  supa: SupabaseClient<any, any, any>,
  companyId: string
) {
  const { data, error } = await (supa as any)
    .from("companies")
    .select("status, paused_reason, closed_reason")
    .eq("id", companyId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      status: 500,
      error: "COMPANY_LOOKUP_FAILED",
      reason: error?.message ?? "Company lookup failed",
    };
  }

  const status = (data.status ?? "active") as CompanyStatus;

  if (status === "paused") {
    return {
      ok: false as const,
      status: 403,
      error: "COMPANY_PAUSED",
      reason: (data.paused_reason as string | null) ?? "Firma er pauset.",
    };
  }

  if (status === "closed") {
    return {
      ok: false as const,
      status: 403,
      error: "COMPANY_CLOSED",
      reason: (data.closed_reason as string | null) ?? "Firma er stengt.",
    };
  }

  return { ok: true as const };
}
