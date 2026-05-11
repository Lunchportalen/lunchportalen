import "server-only";

import { redirect } from "next/navigation";

import { getAgreementStatusForCurrentUser } from "@/lib/agreements/getAgreementStatus";
import { getAuthContext } from "@/lib/auth/getAuthContext";

export type ActiveAgreementContext = {
  companyId: string;
  agreementId: string | null;
  role: "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
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

  const status = await getAgreementStatusForCurrentUser();

  if (status.ok && status.status === "ACTIVE") {
    return {
      companyId: status.companyId,
      agreementId: status.agreementId,
      role: status.role,
    };
  }

  redirect("/avtale-ikke-aktiv");
}
