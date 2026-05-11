import "server-only";

import { redirect } from "next/navigation";

import { getAgreementStatusForCurrentUser } from "@/lib/agreements/getAgreementStatus";

export type ActiveAgreementContext = {
  companyId: string;
  agreementId: string | null;
  role: "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
};

export async function requireActiveAgreement(): Promise<ActiveAgreementContext> {
  const status = await getAgreementStatusForCurrentUser();
  console.error("[DEBUG-requireActiveAgreement]", JSON.stringify({
    ok: status.ok,
    role: status.role,
    status: status.ok ? status.status : "N/A",
    statusReason: status.ok ? (status as any).statusReason : "N/A",
    companyId: status.ok ? status.companyId : "N/A",
    agreementId: status.ok ? status.agreementId : "N/A",
  }));
  const role = status.role;
  const companyId = typeof status.companyId === "string" ? status.companyId : "";

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
