import "server-only";

import { redirect } from "next/navigation";

import { canCompanyOperate, getAgreementStatus } from "@/lib/auth/agreementStatus";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { getProviderMemberships } from "@/lib/auth/provider";
import { normalizeRole } from "@/lib/auth/role";
import { resolveRoleHomeForUser } from "@/lib/auth/roleHome";
import { supabaseServer } from "@/lib/supabase/server";

export type InactiveAgreementPageContext = {
  showProviderRecovery: boolean;
};

function roleNeedsActiveAgreement(role: ReturnType<typeof normalizeRole>): boolean {
  return (
    role === "company_admin" ||
    role === "company_finance" ||
    role === "location_admin" ||
    role === "employee"
  );
}

async function lookupHasActiveAgreement(companyId: string | null): Promise<boolean> {
  if (!companyId) return false;
  try {
    const sb = await supabaseServer();
    const status = await getAgreementStatus(sb as any, companyId);
    return canCompanyOperate(status);
  } catch {
    return false;
  }
}

/**
 * Server-side safety for /avtale-ikke-aktiv:
 * if canonical role resolver says the user belongs elsewhere (e.g. provider portal),
 * redirect before rendering the blocked page.
 */
export async function loadInactiveAgreementPageContext(): Promise<InactiveAgreementPageContext> {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.userId) {
    return { showProviderRecovery: false };
  }

  const memberships = await getProviderMemberships(auth.userId);
  const showProviderRecovery = memberships.length > 0;

  const role = normalizeRole(auth.role);
  const hasActiveAgreement = roleNeedsActiveAgreement(role)
    ? await lookupHasActiveAgreement(auth.company_id)
    : true;

  const home = await resolveRoleHomeForUser({
    userId: auth.userId,
    profileRole: role,
    hasActiveAgreement,
  });

  if (home !== "/avtale-ikke-aktiv" && !home.startsWith("/login")) {
    redirect(home);
  }

  return { showProviderRecovery };
}
