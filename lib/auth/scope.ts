// lib/auth/scope.ts
import "server-only";

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

function isTestEnv() {
  return process.env.NODE_ENV === "test" || !!process.env.VITEST;
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function envOrTestDefault(name: string, fallback: string) {
  const v = process.env[name];
  if (v && String(v).trim()) return String(v).trim();
  if (isTestEnv()) return fallback;
  return mustEnv(name);
}

/**
 * Minimal SSR client. We only need it for:
 * - auth.getUser()
 * - from("profiles") / from("companies")
 *
 * NOTE: we keep types safe (avoid "untyped function calls" TS2347)
 */
function supabaseFromRequest(req: NextRequest) {
  const SUPABASE_URL = envOrTestDefault("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
  const SUPABASE_ANON_KEY = envOrTestDefault("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon_test_key");

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

function normalizeCompanyStatus(v: unknown) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  if (s === "active") return "active";
  if (s === "pending") return "pending";
  if (s === "paused") return "paused";
  if (s === "closed") return "closed";
  return s;
}

/**
 * ENTERPRISE GATE (Blueprint):
 * - Tenant roles MUST be blocked unless company.status === "active"
 * - Enforced centrally here so all route guards inherit it.
 *
 * ✅ IMPORTANT:
 * - System roles (superadmin/kitchen/driver) MUST NEVER be blocked by company status.
 */
async function enforceCompanyActive(
  supabase: ReturnType<typeof supabaseFromRequest>,
  role: Role,
  company_id: string | null
) {
  if (!(role === "company_admin" || role === "employee")) return;
  if (!company_id) throw new ScopeError("Konto mangler firmatilknytning", 403, "COMPANY_MISSING");

  const res = await (supabase as any)
    .from("companies")
    .select("id,status")
    .eq("id", company_id)
    .maybeSingle();

  const error = res?.error as any;
  const data = res?.data as any;

  if (error) throw new ScopeError("Kunne ikke verifisere firmastatus", 503, "COMPANY_STATUS_CHECK_FAILED");
  if (!data?.id) throw new ScopeError("Firma finnes ikke", 403, "COMPANY_NOT_FOUND");

  const st = normalizeCompanyStatus(data.status);
  if (st !== "active") {
    throw new ScopeError("Firma er ikke aktivert ennå", 403, "COMPANY_NOT_ACTIVE");
  }
}

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

  // ✅ NO-EXCEPTION RULE: systemroller vinner alltid og bypasser profile/company gating
  const sys = roleByEmail(user.email ?? null);
  if (sys === "superadmin" || sys === "kitchen" || sys === "driver") {
    return {
      user_id: user.id,
      email: user.email ?? null,
      role: sys,
      company_id: null,
      location_id: null,
      is_active: true,
    };
  }

  // 2) Profile (tenant-roller bruker profile; systemroller kan leve uten)
  const profRes = await (supabase as any)
    .from("profiles")
    .select("id,user_id,email,role,company_id,location_id,is_active")
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .maybeSingle();

  const profile = (profRes?.data ?? null) as ProfileRow | null;
  const profErr = profRes?.error as any;

  // 3) Rolle: profilrolle har førsteprioritet hvis den finnes og er gyldig
  let role: Role;
  const profileRoleRaw = String(profile?.role ?? "").trim();

  if (profileRoleRaw && isValidRole(profileRoleRaw)) {
    role = profileRoleRaw as Role;
  } else {
    role = computeRoleNoDb(user);
  }

  // 4) Hvis profile mangler:
  //    - company_admin/employee MÅ ha profile
  if (!profile || profErr) {
    throw new ScopeError("Profil mangler", 403, "PROFILE_MISSING");
  }

  // 5) Aktivitetsstatus (tenant-only)
  // ✅ FASIT: onboarding oppretter company_admin med is_active=false til aktivering.
  const is_active = profile.is_active === true;

  if ((role === "company_admin" || role === "employee") && !is_active) {
    throw new ScopeError("Konto er ikke aktivert ennå", 403, "ACCOUNT_INACTIVE");
  }

  // 6) Tenant binding: tenant-roller må ha company_id
  if ((role === "company_admin" || role === "employee") && !profile.company_id) {
    throw new ScopeError("Konto mangler firmatilknytning", 403, "COMPANY_MISSING");
  }

  // 7) Enterprise gate: company must be active (tenant-only)
  await enforceCompanyActive(supabase, role, profile.company_id ?? null);

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
