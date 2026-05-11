// src/lib/agreements/getAgreementStatus.ts
import "server-only";

import { getCurrentAgreementState } from "@/lib/agreement/currentAgreement";
import { getScopeServer } from "@/lib/auth/getScopeServer";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

type AgreementStatus = "ACTIVE" | "PAUSED" | "CLOSED" | "MISSING";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export type AgreementStatusForCurrentUser = {
  ok: boolean;
  status: AgreementStatus;
  companyId: string;
  agreementId: string | null;
  role: Role;
};

/**
 * getAgreementStatusForCurrentUser
 *
 * Server-only helper used by requireActiveAgreement.
 * - Uses getScopeServer() for role + company_id (single source of truth).
 * - Uses getCurrentAgreementState() for agreement snapshot.
 * - Fails closed (ok=false, status=MISSING) on any error.
 */
export async function getAgreementStatusForCurrentUser(): Promise<AgreementStatusForCurrentUser> {
  try {
    const { scope } = await getScopeServer();

    const role = (scope.role ?? "employee") as Role;
    const companyId = safeStr(scope.company_id);

    if (!companyId || companyId.length < 10) {
      return {
        ok: false,
        status: "MISSING",
        companyId: "",
        agreementId: null,
        role,
      };
    }

    const state = await getCurrentAgreementState({});

    if (!state.ok) {
      return {
        ok: false,
        status: "MISSING",
        companyId,
        agreementId: null,
        role,
      };
    }

    const status = (state.status ?? "MISSING") as AgreementStatus;

    return {
      ok: true,
      status,
      companyId: state.companyId,
      agreementId: state.agreementId ?? null,
      role,
    };
  } catch {
    return {
      ok: false,
      status: "MISSING",
      companyId: "",
      agreementId: null,
      role: "employee",
    };
  }
}

