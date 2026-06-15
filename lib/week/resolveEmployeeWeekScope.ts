import "server-only";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { jsonErr } from "@/lib/http/respond";

const ALLOWED_ROLES = new Set(["employee", "company_admin"]);

export type EmployeeWeekScopeOk = {
  ok: true;
  companyId: string;
  locationId: string | null;
  userId: string;
  role: string;
};

export type EmployeeWeekScopeErr = {
  ok: false;
  response: Response;
};

export type EmployeeWeekScopeResult = EmployeeWeekScopeOk | EmployeeWeekScopeErr;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * Canonical employee week auth scope — aligned with orders path (getAuthContext → lookupMembership).
 */
export async function resolveEmployeeWeekScope(req: Request, rid: string): Promise<EmployeeWeekScopeResult> {
  const auth = await getAuthContext({ rid, reqHeaders: req.headers });

  if (!auth.isAuthenticated || !auth.userId) {
    return {
      ok: false,
      response: jsonErr(rid, "Ikke innlogget.", 401, "AUTH_REQUIRED"),
    };
  }

  if (auth.reason === "BLOCKED") {
    return {
      ok: false,
      response: jsonErr(rid, "Kontoen er ikke aktiv ennå.", 403, "INACTIVE"),
    };
  }

  if (auth.reason === "NO_PROFILE") {
    return {
      ok: false,
      response: jsonErr(rid, "Mangler firmatilknytning.", 409, "MISSING_COMPANY"),
    };
  }

  if (auth.reason === "ERROR" || !auth.ok || !auth.role) {
    return {
      ok: false,
      response: jsonErr(rid, "Kunne ikke hente profil.", 500, "PROFILE_LOOKUP_FAILED"),
    };
  }

  const role = safeStr(auth.role).toLowerCase();
  if (!ALLOWED_ROLES.has(role)) {
    return {
      ok: false,
      response: jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN"),
    };
  }

  if (!auth.company_id) {
    return {
      ok: false,
      response: jsonErr(rid, "Mangler firmatilknytning.", 409, "MISSING_COMPANY"),
    };
  }

  return {
    ok: true,
    companyId: safeStr(auth.company_id),
    locationId: auth.location_id ? safeStr(auth.location_id) : null,
    userId: auth.userId,
    role,
  };
}
