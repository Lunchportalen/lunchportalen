// lib/auth/scope.ts
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { systemRoleByEmail } from "@/lib/system/emails";

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
   Helpers
========================================================= */

function roleByEmail(email: string | null | undefined): Role | null {
  return systemRoleByEmail(email);
}

function normalizeRole(v: unknown): Role {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "company_admin" || s === "companyadmin" || s === "admin") return "company_admin";
  if (s === "superadmin") return "superadmin";
  if (s === "kitchen") return "kitchen";
  if (s === "driver") return "driver";
  return "employee";
}

function isValidRole(role: any): role is Role {
  return ["superadmin", "company_admin", "employee", "kitchen", "driver"].includes(String(role));
}

function computeRoleNoDb(user: any): Role {
  const emailRole = roleByEmail(user?.email);
  if (emailRole) return emailRole;

  const appRole = normalizeRole(user?.app_metadata?.role);
  if (appRole !== "employee") return appRole;

  const metaRole = normalizeRole(user?.user_metadata?.role);
  return metaRole;
}

/* =========================================================
   Scope loader (FASIT)
========================================================= */

type ProfileRow = {
  id: string | null;
  user_id?: string | null;
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

  // 2) Hent profile (tenant-roller bruker profile; systemroller kan leve uten)
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id,user_id,email,role,company_id,location_id,is_active")
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .maybeSingle<ProfileRow>();

  // 3) Rolle: profilrolle har førsteprioritet hvis den finnes og er gyldig
  let role: Role;

  const profileRoleRaw = (profile?.role ?? "").toString().trim();
  if (profileRoleRaw && isValidRole(profileRoleRaw)) {
    role = profileRoleRaw as Role;
  } else {
    role = computeRoleNoDb(user);
  }

  // 4) Hvis profile mangler:
  //    - superadmin/kitchen/driver kan leve uten profile (systemroller)
  //    - company_admin/employee MÅ ha profile
  if (!profile || profErr) {
    if (role === "superadmin" || role === "kitchen" || role === "driver") {
      return {
        user_id: user.id,
        email: user.email ?? null,
        role,
        company_id: null,
        location_id: null,
        is_active: true,
      };
    }
    throw new ScopeError("Profil mangler", 403, "PROFILE_MISSING");
  }

  // 5) Aktivitetsstatus (håndheves når profile finnes)
  const is_active = profile.is_active !== false;
  if (!is_active) {
    throw new ScopeError("Konto deaktivert", 403, "ACCOUNT_DISABLED");
  }

  // 6) Tenant binding: tenant-roller må ha company_id
  if ((role === "company_admin" || role === "employee") && !profile.company_id) {
    throw new ScopeError("Konto mangler firmatilknytning", 403, "COMPANY_MISSING");
  }

  return {
    user_id: user.id,
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
