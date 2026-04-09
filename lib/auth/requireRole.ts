// lib/auth/requireRole.ts
/**
 * Server-side role checks only — aldri stol på klient.
 * For App Router API: foretrekk {@link scopeOr401} + {@link requireRoleOr403} i `lib/http/routeGuard`.
 */
import { supabaseServer } from "@/lib/supabase/server";

import type { AllowedRole, AuthedCtx } from "@/lib/http/routeGuard";

export async function requireRole(allowed: Array<"superadmin" | "company_admin" | "employee">) {
  const supabase = await supabaseServer();
  const { data: authData, error: authErr } = await supabase.auth.getUser();

  if (authErr || !authData?.user) {
    return { ok: false as const, status: 401, error: "Not authenticated" };
  }

  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("id, role, company_id")
    .eq("id", authData.user.id)
    .single();

  if (profErr || !prof) {
    return { ok: false as const, status: 403, error: "Profile missing" };
  }

  if (!allowed.includes(prof.role)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, userId: authData.user.id, role: prof.role, companyId: prof.company_id, supabase };
}

/** Synkron sjekk etter at {@link AuthedCtx} allerede er etablert (API-ruter). */
export class RoleForbiddenError extends Error {
  readonly code = "FORBIDDEN" as const;
  constructor(message = "FORBIDDEN") {
    super(message);
    this.name = "RoleForbiddenError";
  }
}

export function assertAuthedRole(ctx: AuthedCtx | null | undefined, allowed: ReadonlyArray<AllowedRole>): void {
  const role = ctx?.scope?.role;
  if (!role || !allowed.includes(role as AllowedRole)) {
    throw new RoleForbiddenError();
  }
}

/** Én forventet rolle (alias for enkel gate). */
export function assertRole(ctx: Pick<AuthedCtx, "scope"> | null | undefined, role: AllowedRole): void {
  if (!ctx?.scope?.role || ctx.scope.role !== role) {
    throw new RoleForbiddenError();
  }
}
