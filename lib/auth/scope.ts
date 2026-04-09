// lib/auth/scope.ts
import "server-only";

import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import type { Database } from "@/lib/types/database";

export type Role = "superadmin" | "company_admin" | "employee" | "kitchen" | "driver";

export type Scope = {
  user_id: string;
  email: string | null;
  role: Role;
  company_id: string | null;
  location_id: string | null;
  is_active: boolean;

  /**
   * Billing/Agreement (enterprise gate)
   * - agreement_status: status i company_billing_accounts (active/paused/closed)
   * - billing_hold: true => write lock (UI read-only, API blocks POST/DELETE)
   * - can_act: derived = !billing_hold
   */
  agreement_status?: "active" | "paused" | "closed" | "unknown";
  billing_hold?: boolean;
  billing_hold_reason?: string | null;
  can_act?: boolean;

  /**
   * Agreement location truth (for employee mismatch detection)
   * - Read from public.agreements (ACTIVE if available)
   * - Used by post-login/status routing (LOCATION_MISMATCH)
   */
  agreement_location_id?: string | null;
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
   Env helpers
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

/* =========================================================
   Cookie helpers (TEST-SAFE)
========================================================= */

function parseCookieHeader(raw: string): Array<{ name: string; value: string }> {
  const out: Array<{ name: string; value: string }> = [];
  if (!raw) return out;

  for (const part of String(raw).split(";")) {
    const p = part.trim();
    if (!p) continue;
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const name = p.slice(0, idx).trim();
    const value = p.slice(idx + 1).trim();
    if (!name) continue;
    out.push({ name, value });
  }
  return out;
}

/**
 * NextRequest has req.cookies.getAll(), but plain Request in vitest does not.
 */
function getCookiesAll(req: NextRequest): Array<{ name: string; value: string }> {
  const anyReq: any = req as any;

  const cookiesApi = anyReq?.cookies;
  if (cookiesApi && typeof cookiesApi.getAll === "function") {
    try {
      return cookiesApi.getAll().map((c: any) => ({ name: c.name, value: c.value }));
    } catch {
      return [];
    }
  }

  try {
    const h = anyReq?.headers;
    const raw =
      (h && typeof h.get === "function" ? h.get("cookie") : null) ??
      (typeof h?.cookie === "string" ? h.cookie : "");
    return parseCookieHeader(raw ?? "");
  } catch {
    return [];
  }
}

/* =========================================================
   Supabase (SSR-safe)
========================================================= */

function supabaseFromRequest(req: NextRequest) {
  const SUPABASE_URL = envOrTestDefault("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
  const SUPABASE_ANON_KEY = envOrTestDefault("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon_test_key");

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return getCookiesAll(req);
      },
      setAll() {
        return;
      },
    },
  });
}

/* =========================================================
   Scope loader (FASIT)
========================================================= */

function normalizeStatus(v: unknown) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  if (s === "active") return "active";
  if (s === "pending") return "pending";
  if (s === "paused") return "paused";
  if (s === "closed") return "closed";
  return s;
}

/**
 * ENTERPRISE GATE:
 * - Tenant roles blocked unless companies.status === "active"
 * - System roles bypass
 */
async function enforceCompanyActive(
  supabase: ReturnType<typeof supabaseFromRequest>,
  role: Role,
  company_id: string | null
) {
  if (role === "superadmin") return;
  if (!company_id) throw new ScopeError("Konto mangler firmatilknytning", 403, "COMPANY_MISSING");

  const res = await supabase.from("companies").select("id,status").eq("id", company_id).maybeSingle();

  const error = res?.error as any;
  const data = res?.data as any;

  if (error) throw new ScopeError("Kunne ikke verifisere firmastatus", 503, "COMPANY_STATUS_CHECK_FAILED");
  if (!data?.id) throw new ScopeError("Firma finnes ikke", 403, "COMPANY_NOT_FOUND");

  const st = normalizeStatus(data.status);
  if (st !== "active") {
    throw new ScopeError("Firma er ikke aktivert ennå", 403, "COMPANY_NOT_ACTIVE");
  }
}

type BillingRow = {
  company_id: string;
  status: string | null;
  billing_hold: boolean | null;
  billing_hold_reason: string | null;
};

/**
 * AGREEMENT/BILLING GATE (fasit hos dere):
 * - Tenant roles require company_billing_accounts row
 * - company_billing_accounts.status must be "active"
 * - billing_hold => scope.can_act=false (UI read-only)
 */
async function enforceAgreementAndBilling(
  supabase: ReturnType<typeof supabaseFromRequest>,
  role: Role,
  company_id: string | null
): Promise<Pick<Scope, "agreement_status" | "billing_hold" | "billing_hold_reason" | "can_act">> {
  if (!(role === "company_admin" || role === "employee")) {
    return { agreement_status: "unknown", billing_hold: false, billing_hold_reason: null, can_act: true };
  }
  if (!company_id) throw new ScopeError("Konto mangler firmatilknytning", 403, "COMPANY_MISSING");

  const res = await supabase
    .from("company_billing_accounts")
    .select("company_id,status,billing_hold,billing_hold_reason")
    .eq("company_id", company_id)
    .maybeSingle();

  const error = res?.error as any;
  const data = (res?.data ?? null) as BillingRow | null;

  if (error) throw new ScopeError("Kunne ikke verifisere avtale", 503, "AGREEMENT_CHECK_FAILED");
  if (!data?.company_id) throw new ScopeError("Firma mangler aktiv avtale", 403, "AGREEMENT_MISSING");

  const st = normalizeStatus(data.status);
  if (st !== "active") {
    if (st === "paused") throw new ScopeError("Firmaet er midlertidig pauset", 403, "AGREEMENT_PAUSED");
    if (st === "closed") throw new ScopeError("Firmaet er stengt", 403, "AGREEMENT_CLOSED");
    throw new ScopeError("Avtale er ikke aktiv", 403, "AGREEMENT_NOT_ACTIVE");
  }

  const hold = data.billing_hold === true;
  return {
    agreement_status: "active",
    billing_hold: hold,
    billing_hold_reason: data.billing_hold_reason ?? null,
    can_act: !hold,
  };
}

/**
 * Agreement location truth for mismatch detection.
 * Reads from public.agreements (ACTIVE if present, else newest).
 * If table missing / no rows -> null (fail-closed handled elsewhere).
 */
async function getAgreementLocationId(
  supabase: ReturnType<typeof supabaseFromRequest>,
  company_id: string | null
): Promise<string | null> {
  if (!company_id) return null;

  const res = await supabase
    .from("agreements")
    .select("company_id,status,location_id,updated_at")
    .eq("company_id", company_id)
    .order("updated_at", { ascending: false })
    .limit(10);

  const error = res?.error as any;
  const rows = (res?.data ?? null) as Array<any> | null;

  if (error || !Array.isArray(rows) || rows.length === 0) return null;

  const active = rows.find((r) => normalizeStatus(r?.status) === "active");
  const row = active ?? rows[0];
  const loc = String(row?.location_id ?? "").trim();
  return loc || null;
}

export async function getScope(req: NextRequest): Promise<Scope> {
  const auth = await getAuthContext({ reqHeaders: req.headers });
  if (!auth.isAuthenticated || !auth.userId) {
    throw new ScopeError("Ikke innlogget", 401, "UNAUTHENTICATED");
  }

  if (auth.reason === "NO_PROFILE") {
    throw new ScopeError("Profil mangler", 403, "PROFILE_MISSING");
  }

  if (auth.reason === "BLOCKED") {
    throw new ScopeError("Konto er ikke aktivert ennå", 403, "ACCOUNT_INACTIVE");
  }

  if (!auth.ok || !auth.role) {
    throw new ScopeError("Kunne ikke hente profil", 503, "PROFILE_LOOKUP_FAILED");
  }

  if (auth.mode === "DEV_BYPASS") {
    return {
      user_id: auth.userId,
      email: auth.email,
      role: auth.role,
      company_id: auth.company_id,
      location_id: auth.location_id,
      is_active: true,
      agreement_status: "unknown",
      billing_hold: false,
      billing_hold_reason: null,
      can_act: true,
      agreement_location_id: null,
    };
  }

  if (auth.role === "superadmin") {
    return {
      user_id: auth.userId,
      email: auth.email,
      role: auth.role,
      company_id: null,
      location_id: null,
      is_active: true,
      agreement_status: "unknown",
      billing_hold: false,
      billing_hold_reason: null,
      can_act: true,
      agreement_location_id: null,
    };
  }

  const supabase = supabaseFromRequest(req);
  const role = auth.role;

  await enforceCompanyActive(supabase, role, auth.company_id ?? null);
  const billing = await enforceAgreementAndBilling(supabase, role, auth.company_id ?? null);
  const agreement_location_id = await getAgreementLocationId(supabase, auth.company_id ?? null);

  return {
    user_id: auth.userId,
    email: auth.email,
    role,
    company_id: auth.company_id ?? null,
    location_id: auth.location_id ?? null,
    is_active: true,

    agreement_status: billing.agreement_status,
    billing_hold: billing.billing_hold,
    billing_hold_reason: billing.billing_hold_reason,
    can_act: billing.can_act,

    agreement_location_id,
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

export function allowSuperadminOrKitchen(scope: Scope) {
  return requireRole(scope, ["superadmin", "kitchen"]);
}

export function allowSuperadminOrDriver(scope: Scope) {
  return requireRole(scope, ["superadmin", "driver"]);
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

export function effectiveCompanyId(scope: Scope, requestedCompanyId?: string | null) {
  if (scope.role === "superadmin") {
    return requestedCompanyId ?? null;
  }
  return mustCompanyId(scope);
}

