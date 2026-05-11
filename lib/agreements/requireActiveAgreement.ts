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

export async function requireActiveAgreement(): Promise<ActiveAgreementContext> {
  // Canonical role from auth context. getAgreementStatusForCurrentUser falls
  // back to role="employee" on internal errors, which would otherwise route
  // non-employee roles (e.g. company_admin) through the employee-only
  // agreement gate and into /avtale-ikke-aktiv.
  const auth = await getAuthContext();
  const authRole = auth.ok ? auth.role : null;

  if (authRole && authRole !== "employee") {
    return {
      companyId: safeCompanyId(auth.company_id),
      agreementId: null,
      role: authRole,
    };
  }

  const status = await getAgreementStatusForCurrentUser();
  const role = status.role;
  const companyId = safeCompanyId(status.companyId);

  if (role && role !== "employee") {
    return {
      companyId,
      agreementId: status.ok ? status.agreementId : null,
      role,
    };
  }

  if (status.ok && status.status === "ACTIVE") {
    return {
      companyId: status.companyId,
      agreementId: status.agreementId,
      role: status.role,
    };
  }

  redirect("/avtale-ikke-aktiv");
}
