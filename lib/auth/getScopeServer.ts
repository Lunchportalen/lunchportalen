// lib/auth/getScopeServer.ts
import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { ScopeError, type Scope, type Role as ScopeRole } from "@/lib/auth/scope";
import { systemRoleByEmail } from "@/lib/system/emails";

type BillingGate = {
  agreement_status: "active" | "paused" | "closed" | "unknown";
  billing_hold: boolean;
  billing_hold_reason: string | null;
  can_act: boolean;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeStatus(v: unknown) {
  const s = safeStr(v).toLowerCase();
  if (!s) return "unknown";
  if (s === "active") return "active";
  if (s === "pending") return "pending";
  if (s === "paused") return "paused";
  if (s === "closed") return "closed";
  return s;
}

function roleByEmail(email: string | null | undefined): ScopeRole | null {
  return systemRoleByEmail(email);
}

function normalizeRole(v: unknown): ScopeRole {
  const s = safeStr(v).toLowerCase();
  if (s === "company_admin" || s === "companyadmin" || s === "admin") return "company_admin";
  if (s === "superadmin") return "superadmin";
  if (s === "kitchen") return "kitchen";
  if (s === "driver") return "driver";
  return "employee";
}

function isValidRole(role: any): role is ScopeRole {
  return ["superadmin", "company_admin", "employee", "kitchen", "driver"].includes(String(role));
}

async function enforceCompanyActive(sb: any, role: ScopeRole, company_id: string | null) {
  if (role === "superadmin") return;
  if (!company_id) throw new ScopeError("Konto mangler firmatilknytning", 403, "COMPANY_MISSING");

  const { data, error } = await sb.from("companies").select("id,status").eq("id", company_id).maybeSingle();

  if (error) throw new ScopeError("Kunne ikke verifisere firmastatus", 503, "COMPANY_STATUS_CHECK_FAILED");
  if (!data?.id) throw new ScopeError("Firma finnes ikke", 403, "COMPANY_NOT_FOUND");

  const st = normalizeStatus(data.status);
  if (st !== "active") throw new ScopeError("Firma er ikke aktivert ennå", 403, "COMPANY_NOT_ACTIVE");
}

async function enforceAgreementAndBilling(sb: any, role: ScopeRole, company_id: string | null): Promise<BillingGate> {
  if (!(role === "company_admin" || role === "employee")) {
    return { agreement_status: "unknown", billing_hold: false, billing_hold_reason: null, can_act: true };
  }
  if (!company_id) throw new ScopeError("Konto mangler firmatilknytning", 403, "COMPANY_MISSING");

  const { data, error } = await sb
    .from("company_billing_accounts")
    .select("company_id,status,billing_hold,billing_hold_reason")
    .eq("company_id", company_id)
    .maybeSingle();

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

// ✅ NEW: agreement location truth for mismatch checks (employee)
async function getAgreementLocationId(sb: any, company_id: string | null): Promise<string | null> {
  if (!company_id) return null;

  // Prefer ACTIVE agreement record
  const { data, error } = await sb
    .from("agreements")
    .select("company_id,status,location_id,updated_at")
    .eq("company_id", company_id)
    .order("updated_at", { ascending: false })
    .limit(5);

  if (error || !Array.isArray(data) || data.length === 0) return null;

  const active = data.find((r: any) => normalizeStatus(r?.status) === "active");
  const row = active ?? data[0];
  return safeStr(row?.location_id) || null;
}

/**
 * getScopeServer (FASIT)
 * - profiles.user_id is authoritative FK to auth.users.id in your schema.
 */
export async function getScopeServer(): Promise<{ user: any; scope: Scope & { agreement_location_id?: string | null } }> {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  const user = data?.user ?? null;

  if (error || !user) {
    throw new ScopeError("Ikke innlogget", 401, "UNAUTHENTICATED");
  }

  // Kun superadmin bypasser tenant gates
  const sys = roleByEmail(user.email ?? null);
  if (sys === "superadmin") {
    const scope: Scope & { agreement_location_id?: string | null } = {
      user_id: user.id,
      email: user.email ?? null,
      role: sys,
      company_id: null,
      location_id: null,
      is_active: true,
      agreement_status: "unknown",
      billing_hold: false,
      billing_hold_reason: null,
      can_act: true,
      agreement_location_id: null,
    };
    return { user, scope };
  }

  // ✅ Deterministic profile lookup
  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("id,user_id,email,role,company_id,location_id,is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (pErr) throw new ScopeError("Kunne ikke hente profil", 503, "PROFILE_LOOKUP_FAILED");
  if (!profile) throw new ScopeError("Profil mangler", 403, "PROFILE_MISSING");

  const profileRoleRaw = safeStr(profile.role);
  const role: ScopeRole =
    profileRoleRaw && isValidRole(profileRoleRaw)
      ? (profileRoleRaw as ScopeRole)
      : normalizeRole(user?.app_metadata?.role ?? user?.user_metadata?.role);

  const is_active = profile.is_active === true;

  if (role !== "superadmin" && !is_active) {
    throw new ScopeError("Konto er ikke aktivert ennå", 403, "ACCOUNT_INACTIVE");
  }

  if ((role === "company_admin" || role === "employee") && !profile.company_id) {
    throw new ScopeError("Konto mangler firmatilknytning", 403, "COMPANY_MISSING");
  }
  if ((role === "kitchen" || role === "driver") && (!profile.company_id || !profile.location_id)) {
    throw new ScopeError("Scope er ikke tilordnet", 403, "SCOPE_NOT_ASSIGNED");
  }

  await enforceCompanyActive(sb, role, profile.company_id ?? null);
  const billing = await enforceAgreementAndBilling(sb, role, profile.company_id ?? null);

  // ✅ agreement location truth (used for mismatch)
  const agreement_location_id = await getAgreementLocationId(sb, profile.company_id ?? null);

  const scope: Scope & { agreement_location_id?: string | null } = {
    user_id: user.id,
    email: profile.email ?? user.email ?? null,
    role,
    company_id: profile.company_id ?? null,
    location_id: profile.location_id ?? null,
    is_active,
    agreement_status: billing.agreement_status,
    billing_hold: billing.billing_hold,
    billing_hold_reason: billing.billing_hold_reason,
    can_act: billing.can_act,
    agreement_location_id,
  };

  return { user, scope };
}

