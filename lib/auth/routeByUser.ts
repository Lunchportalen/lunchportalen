// STATUS: KEEP

// lib/auth/routeByUser.ts
import "server-only";

import { systemRoleByEmail } from "@/lib/system/emails";
import { normalizeRoleDefaultEmployee } from "@/lib/auth/role";
import { getScopeServer } from "@/lib/auth/getScopeServer";
import { homeForRole, homeForUser, type Role } from "@/lib/auth/redirect";

export type { Role };

/**
 * Legacy fallback: user-only routing (no DB).
 * Keep for safety, but DO NOT use it in post-login flows when DB is available.
 */
export function destinationForUser(user: { email?: string | null; user_metadata?: any }): { role: Role; path: string } {
  const systemRole = systemRoleByEmail(user.email);
  if (systemRole === "superadmin") return { role: "superadmin", path: "/superadmin" };
  if (systemRole === "kitchen") return { role: "kitchen", path: "/kitchen" };
  if (systemRole === "driver") return { role: "driver", path: "/driver" };

  const role = normalizeRoleDefaultEmployee(user.user_metadata?.role ?? "employee");
  return { role, path: homeForRole(role) };
}

/**
 * Enterprise routing: use DB truth (profiles + companies + company_billing_accounts).
 * Intended for server-side post-login router.
 */
export async function destinationForCurrentUser(): Promise<{ role: Role; path: string }> {
  const { scope } = await getScopeServer();

  const role = scope.role as Role;

  // Use enterprise home routing (agreement/billing aware)
  const path = homeForUser({
    role,
    company_id: scope.company_id,
    location_id: scope.location_id,
    agreement_status: scope.agreement_status ?? "unknown",
    billing_hold: scope.billing_hold ?? false,
    is_active: scope.is_active,
  });

  return { role, path };
}
