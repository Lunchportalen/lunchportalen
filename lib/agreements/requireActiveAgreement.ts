import "server-only";

import { redirect } from "next/navigation";

import { canCompanyOperate, getAgreementStatus } from "@/lib/auth/agreementStatus";
import type { AuthRole } from "@/lib/auth/getAuthContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { supabaseServer } from "@/lib/supabase/server";

export type ActiveAgreementContext = {
  companyId: string;
  agreementId: string | null;
  role: NonNullable<AuthRole>;
};

function safeCompanyId(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Gate used by /week and other tenant surfaces.
 *
 * Bypass policy: only `superadmin` skips the agreement check. All other
 * roles — including `company_admin` — must have an ACTIVE agreement on
 * their company or get redirected to /avtale-ikke-aktiv. This matches
 * the login-router contract: company_admin is sent to /admin only when
 * an active agreement exists, and /admin's guard mirrors the same rule.
 */
export async function requireActiveAgreement(): Promise<ActiveAgreementContext> {
  const auth = await getAuthContext();
  const authRole = auth.ok ? auth.role : null;

  if (authRole === "superadmin") {
    return {
      companyId: safeCompanyId(auth.company_id),
      agreementId: null,
      role: "superadmin",
    };
  }

  const companyId = safeCompanyId(auth.company_id);
  if (!auth.ok || !authRole || !companyId) {
    redirect("/avtale-ikke-aktiv");
  }

  const sb = await supabaseServer();
  const status = await getAgreementStatus(sb as any, companyId);

  if (canCompanyOperate(status)) {
    return {
      companyId,
      agreementId: status.agreementId,
      role: authRole,
    };
  }

  redirect("/avtale-ikke-aktiv");
}
