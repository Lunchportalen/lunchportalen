// lib/auth/scope.ts
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";

export type Role = "superadmin" | "company_admin" | "employee" | "kitchen" | "driver";

export type Scope = {
  user_id: string;
  email: string | null;
  role: Role;
  company_id: string | null;
  location_id: string | null;
  is_active: boolean;
};

export class ScopeError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 403, code = "FORBIDDEN") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const SUPABASE_URL = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_ANON = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

function makeSupabase(req: NextRequest) {
  // Next.js Route Handlers: we can read cookies from request, but cannot set cookies here reliably.
  // That’s ok for server-side auth checks.
  const cookies = {
    getAll() {
      // @supabase/ssr expects array of { name, value }
      return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
    },
    setAll(_cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
      // no-op: route handlers usually don't need to mutate cookies for reads
    },
  };

  return createServerClient(SUPABASE_URL, SUPABASE_ANON, { cookies });
}

type ProfileRow = {
  user_id: string;
  email: string | null;
  role: Role;
  company_id: string | null;
  location_id: string | null;
  is_active: boolean | null;
};

function assertRole(role: any): Role {
  const ok: Role[] = ["superadmin", "company_admin", "employee", "kitchen", "driver"];
  if (!ok.includes(role)) throw new ScopeError("Ugyldig rolle i profil.", 403, "ROLE_INVALID");
  return role;
}

/**
 * Reads the authenticated user and loads profile scope from public.profiles.
 * Your schema: profiles primary key is user_id (uuid).
 *
 * IMPORTANT: This must be used at the top of every /api/* route.
 */
export async function getScope(req: NextRequest): Promise<Scope> {
  const supabase = makeSupabase(req);

  const {
    data: { user },
    error: uErr,
  } = await supabase.auth.getUser();

  if (uErr || !user) throw new ScopeError("Ikke innlogget.", 401, "UNAUTHENTICATED");

  const user_id = user.id;

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("user_id,email,role,company_id,location_id,is_active")
    .eq("user_id", user_id)
    .single();

  if (pErr || !profile) throw new ScopeError("Profil mangler. Kontakt support.", 403, "PROFILE_MISSING");

  const role = assertRole((profile as ProfileRow).role);
  const is_active = Boolean((profile as ProfileRow).is_active ?? true);

  if (!is_active) throw new ScopeError("Kontoen er deaktivert.", 403, "ACCOUNT_DISABLED");

  const scope: Scope = {
    user_id,
    email: (profile as ProfileRow).email ?? user.email ?? null,
    role,
    company_id: (profile as ProfileRow).company_id ?? null,
    location_id: (profile as ProfileRow).location_id ?? null,
    is_active,
  };

  // Enforce company binding for tenant roles
  if ((role === "company_admin" || role === "employee") && !scope.company_id) {
    throw new ScopeError("Konto mangler firmatilknytning.", 403, "COMPANY_MISSING");
  }

  return scope;
}

/* =========================================================
   Role Guards (use inside routes)
========================================================= */

export function requireRole(scope: Scope, allowed: Role[]) {
  if (!allowed.includes(scope.role)) {
    throw new ScopeError("Ingen tilgang.", 403, "FORBIDDEN_ROLE");
  }
  return scope;
}

export function requireSuperadmin(scope: Scope) {
  return requireRole(scope, ["superadmin"]);
}

export function requireCompanyAdmin(scope: Scope) {
  return requireRole(scope, ["company_admin"]);
}

export function requireEmployee(scope: Scope) {
  return requireRole(scope, ["employee"]);
}

export function requireKitchen(scope: Scope) {
  return requireRole(scope, ["kitchen"]);
}

export function requireDriver(scope: Scope) {
  return requireRole(scope, ["driver"]);
}

export function allowSuperadminOrCompanyAdmin(scope: Scope) {
  return requireRole(scope, ["superadmin", "company_admin"]);
}

export function allowSuperadminOrKitchen(scope: Scope) {
  return requireRole(scope, ["superadmin", "kitchen"]);
}

export function allowSuperadminOrDriver(scope: Scope) {
  return requireRole(scope, ["superadmin", "driver"]);
}

/* =========================================================
   Tenant-safe helpers
========================================================= */

/**
 * Returns company_id for tenant-filtering.
 * - For company_admin/employee: their own company_id
 * - For superadmin: can optionally specify a target company_id
 *
 * NOTE: Do not accept client-provided company_id unless scope.role === 'superadmin'
 */
export function effectiveCompanyId(scope: Scope, requestedCompanyId?: string | null) {
  if (scope.role === "superadmin") return requestedCompanyId ?? null;
  return scope.company_id;
}

/**
 * Convenience: strict company filter for tenant roles.
 * Throws if company_id is missing.
 */
export function mustCompanyId(scope: Scope) {
  if (!scope.company_id) throw new ScopeError("Mangler firmatilknytning.", 403, "COMPANY_MISSING");
  return scope.company_id;
}
