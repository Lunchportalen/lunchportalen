// src/lib/agreements/getAgreementStatus.ts
import "server-only";

import { getCurrentAgreementState } from "@/lib/agreement/currentAgreement";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { getScopeServer } from "@/lib/auth/getScopeServer";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

type AgreementStatus = "ACTIVE" | "PAUSED" | "CLOSED" | "MISSING";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

async function resolveAuthRole(): Promise<Role> {
  try {
    const auth = await getAuthContext();
    if (auth.ok && auth.role) return auth.role as Role;
  } catch {
    // fall through
  }
  return "employee";
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
 * - Role is taken from getAuthContext() (canonical), not from getScopeServer
 *   fallbacks, so non-employee roles cannot be silently downgraded to
 *   "employee" when scope resolution throws.
 * - Uses getCurrentAgreementState() for agreement snapshot.
 * - Fails closed (ok=false, status=MISSING) on any error.
 */
export async function getAgreementStatusForCurrentUser(): Promise<AgreementStatusForCurrentUser> {
  const role = await resolveAuthRole();

  try {
    const { scope } = await getScopeServer();

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
      role,
    };
  }
}
