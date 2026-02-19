import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { systemRoleByEmail } from "@/lib/system/emails";

export type AgreementContextRole = "superadmin" | "company_admin" | "employee" | "kitchen" | "driver" | "unknown";
export type AgreementStatus = "PENDING" | "ACTIVE" | "PAUSED" | "CLOSED" | "MISSING" | "UNKNOWN" | "N_A";
export type CompanyStatus = "PENDING" | "ACTIVE" | "PAUSED" | "CLOSED" | "MISSING" | "UNKNOWN" | "N_A";

export type AgreementContextResult = {
  ok: boolean;
  role: AgreementContextRole;
  companyId: string | null;
  agreementStatus: AgreementStatus;
  companyStatus: CompanyStatus;
  blocked: boolean;
  blockedReason: string | null;
};

type ProfileRow = { role: string | null; company_id: string | null };
type AgreementRow = { status: string | null };
type CompanyRow = { status: string | null };

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeRole(value: unknown): AgreementContextRole {
  const role = safeStr(value).toLowerCase();
  if (role === "superadmin" || role === "super_admin") return "superadmin";
  if (role === "company_admin" || role === "companyadmin" || role === "admin") return "company_admin";
  if (role === "employee" || role === "ansatt") return "employee";
  if (role === "kitchen" || role === "kjokken") return "kitchen";
  if (role === "driver" || role === "sjafor") return "driver";
  return "unknown";
}

function normalizeAgreementStatus(value: unknown): AgreementStatus {
  const status = safeStr(value).toUpperCase();
  if (status === "PENDING") return "PENDING";
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "PAUSED") return "PAUSED";
  if (status === "CLOSED") return "CLOSED";
  if (!status) return "MISSING";
  return "UNKNOWN";
}

function normalizeCompanyStatus(value: unknown): CompanyStatus {
  const status = safeStr(value).toUpperCase();
  if (status === "PENDING") return "PENDING";
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "PAUSED") return "PAUSED";
  if (status === "CLOSED") return "CLOSED";
  if (!status) return "MISSING";
  return "UNKNOWN";
}

export function isAgreementActive(agreementStatus: AgreementStatus, companyStatus: CompanyStatus): boolean {
  return agreementStatus === "ACTIVE" && companyStatus === "ACTIVE";
}

async function loadProfile(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string
): Promise<ProfileRow | null> {
  // Some repos use profiles.id=user_id, others use profiles.user_id. Support both.
  const byId = await sb.from("profiles").select("role,company_id").eq("id", userId).maybeSingle<ProfileRow>();
  if (!byId.error && byId.data) return byId.data;

  const byUserId = await sb.from("profiles").select("role,company_id").eq("user_id", userId).maybeSingle<ProfileRow>();
  if (!byUserId.error && byUserId.data) return byUserId.data;

  return null;
}

async function fetchCompanyStatus(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  companyId: string
): Promise<CompanyStatus> {
  const res = await sb.from("companies").select("status").eq("id", companyId).maybeSingle<CompanyRow>();
  if (res.error) return "UNKNOWN";
  return normalizeCompanyStatus(res.data?.status);
}

async function fetchAgreementStatus(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  companyId: string
): Promise<AgreementStatus> {
  // Prefer deterministic ordering if created_at exists; if not, fall back to a simple select.
  const ordered = await sb
    .from("agreements")
    .select("status")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AgreementRow>();

  if (!ordered.error) {
    return normalizeAgreementStatus(ordered.data?.status);
  }

  const fallback = await sb.from("agreements").select("status").eq("company_id", companyId).limit(1).maybeSingle<AgreementRow>();
  if (!fallback.error) {
    return normalizeAgreementStatus(fallback.data?.status);
  }

  return "UNKNOWN";
}

export async function loadAgreementContext(): Promise<AgreementContextResult> {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  const user = data?.user ?? null;

  if (error || !user?.id) {
    return {
      ok: false,
      role: "unknown",
      companyId: null,
      agreementStatus: "UNKNOWN",
      companyStatus: "UNKNOWN",
      blocked: true,
      blockedReason: "NO_SESSION",
    };
  }

  const emailRole = systemRoleByEmail(user.email ?? null);
  const profile = await loadProfile(sb, user.id);
  const role = normalizeRole(emailRole ?? profile?.role ?? user.user_metadata?.role);

  // Superadmin bypasses agreement gating (global ops role), but remains deterministic.
  if (role === "superadmin") {
    return {
      ok: true,
      role: "superadmin",
      companyId: null,
      agreementStatus: "N_A",
      companyStatus: "N_A",
      blocked: false,
      blockedReason: null,
    };
  }

  // In this repo, kitchen/driver are treated as company-scoped (same gate as employee/company_admin).
  const companyScopedRole = role === "company_admin" || role === "employee" || role === "kitchen" || role === "driver";
  const companyId = companyScopedRole ? safeStr(profile?.company_id) || null : null;

  if (role === "unknown") {
    return {
      ok: false,
      role: "unknown",
      companyId,
      agreementStatus: "UNKNOWN",
      companyStatus: "UNKNOWN",
      blocked: true,
      blockedReason: "ROLE_UNKNOWN",
    };
  }

  if (companyScopedRole && !companyId) {
    return {
      ok: false,
      role,
      companyId: null,
      agreementStatus: "MISSING",
      companyStatus: "MISSING",
      blocked: true,
      blockedReason: "COMPANY_MISSING",
    };
  }

  // Non-company-scoped roles (if any in future) are fail-closed unless explicitly allowed.
  if (!companyScopedRole) {
    return {
      ok: false,
      role,
      companyId: null,
      agreementStatus: "UNKNOWN",
      companyStatus: "UNKNOWN",
      blocked: true,
      blockedReason: "ROLE_NOT_SUPPORTED",
    };
  }

  // At this point companyId is guaranteed.
  const companyStatus = await fetchCompanyStatus(sb, companyId!);
  const agreementStatus = await fetchAgreementStatus(sb, companyId!);

  if (!isAgreementActive(agreementStatus, companyStatus)) {
    return {
      ok: false,
      role,
      companyId: companyId!,
      agreementStatus,
      companyStatus,
      blocked: true,
      blockedReason:
        agreementStatus === "MISSING" || agreementStatus === "UNKNOWN"
          ? "AGREEMENT_MISSING_OR_UNKNOWN"
          : companyStatus !== "ACTIVE"
          ? "COMPANY_NOT_ACTIVE"
          : "AGREEMENT_NOT_ACTIVE",
    };
  }

  return {
    ok: true,
    role,
    companyId: companyId!,
    agreementStatus,
    companyStatus,
    blocked: false,
    blockedReason: null,
  };
}
