// lib/auth/scope.ts
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export type Role = "superadmin" | "company_admin" | "employee" | "kitchen" | "driver";

export type Scope = {
  user_id: string;
  email: string | null;
  role: Role;
  company_id: string | null;
  location_id: string | null;
  is_active: boolean;
};

/* =========================================================
   Errors
========================================================= */

export class ScopeError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 403, code = "FORBIDDEN") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/* =========================================================
   Supabase (SSR-safe)
========================================================= */

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const SUPABASE_URL = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_ANON_KEY = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

function supabaseFromRequest(req: NextRequest) {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll() {
        // no-op (API routes should not mutate auth cookies)
      },
    },
  });
}

/* =========================================================
   Scope loader (FASIT)
========================================================= */

type ProfileRow = {
  user_id: string;
  email: string | null;
  role: string | null;
  company_id: string | null;
  location_id: string | null;
  is_active: boolean | null;
};

export async function getScope(req: NextRequest): Promise<Scope> {
  const supabase = supabaseFromRequest(req);

  // 1) Auth user
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    throw new ScopeError("Ikke innlogget", 401, "UNAUTHENTICATED");
  }

  // 2) Profile
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("user_id,email,role,company_id,location_id,is_active")
    .eq("user_id", user.id)
    .single<ProfileRow>();

  if (profErr || !profile) {
    throw new ScopeError("Profil mangler", 403, "PROFILE_MISSING");
  }

  const roleRaw = (profile.role ?? "").toString();
  if (!isValidRole(roleRaw)) {
    throw new ScopeError("Ugyldig rolle", 403, "ROLE_INVALID");
  }

  const role: Role = roleRaw;
  const is_active = profile.is_active !== false;

  if (!is_active) {
    throw new ScopeError("Konto deaktivert", 403, "ACCOUNT_DISABLED");
  }

  // 3) Tenant binding
  if ((role === "company_admin" || role === "employee") && !profile.company_id) {
    throw new ScopeError("Konto mangler firmatilknytning", 403, "COMPANY_MISSING");
  }

  return {
    user_id: profile.user_id,
    email: profile.email ?? user.email ?? null,
    role,
    company_id: profile.company_id ?? null,
    location_id: profile.location_id ?? null,
    is_active,
  };
}

/* =========================================================
   Role guards
========================================================= */

function isValidRole(role: any): role is Role {
  return ["superadmin", "company_admin", "employee", "kitchen", "driver"].includes(String(role));
}

export function requireRole(scope: Scope, allowed: Role[]) {
  if (!allowed.includes(scope.role)) {
    throw new ScopeError("Ingen tilgang", 403, "FORBIDDEN_ROLE");
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

/* =========================================================
   Tenant helpers
========================================================= */

export function mustCompanyId(scope: Scope): string {
  if (!scope.company_id) {
    throw new ScopeError("Mangler firmatilknytning", 403, "COMPANY_MISSING");
  }
  return scope.company_id;
}

/**
 * For superadmin:
 *  - can optionally target another company
 * For tenant roles:
 *  - always locked to own company
 */
export function effectiveCompanyId(scope: Scope, requestedCompanyId?: string | null) {
  if (scope.role === "superadmin") {
    return requestedCompanyId ?? null;
  }
  return mustCompanyId(scope);
}
