// lib/auth/getScopeServer.ts
import "server-only";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { supabaseServer } from "@/lib/supabase/server";
import { ScopeError, type Scope, type Role as ScopeRole } from "@/lib/auth/scope";

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
  const auth = await getAuthContext();
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

  const user = { id: auth.userId, email: auth.email };

  if (auth.mode === "DEV_BYPASS") {
    const scope: Scope & { agreement_location_id?: string | null } = {
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
    return { user, scope };
  }

  const role = auth.role as ScopeRole;
  if (role === "superadmin") {
    const scope: Scope & { agreement_location_id?: string | null } = {
      user_id: auth.userId,
      email: auth.email,
      role,
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

  const sb = await supabaseServer();
  await enforceCompanyActive(sb, role, auth.company_id ?? null);
  const billing = await enforceAgreementAndBilling(sb, role, auth.company_id ?? null);

  // ✅ agreement location truth (used for mismatch)
  const agreement_location_id = await getAgreementLocationId(sb, auth.company_id ?? null);

  const scope: Scope & { agreement_location_id?: string | null } = {
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

  return { user, scope };
}

