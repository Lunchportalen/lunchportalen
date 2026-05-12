import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
export type Tier = "BASIS" | "LUXUS" | "ENTERPRISE";
export type AgreementDayTiers = Record<DayKey, Tier | null>;

export type AgreementStatusResult = {
  agreementId: string | null;
  tier: Tier | null;
  dayTiers: AgreementDayTiers;
  status: "ACTIVE" | "PENDING" | "PAUSED" | "CLOSED" | "REJECTED" | null;
  isActive: boolean;
  billingHold: boolean;
};

const EMPTY_DAY_TIERS: AgreementDayTiers = {
  mon: null,
  tue: null,
  wed: null,
  thu: null,
  fri: null,
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeTier(v: unknown): AgreementStatusResult["tier"] {
  const s = safeStr(v).toUpperCase();
  if (s === "BASIS" || s === "LUXUS" || s === "ENTERPRISE") return s;
  return null;
}

function normalizeStatus(v: unknown): AgreementStatusResult["status"] {
  const s = safeStr(v).toUpperCase();
  if (s === "ACTIVE" || s === "PENDING" || s === "PAUSED" || s === "CLOSED" || s === "REJECTED") return s;
  return null;
}

function isMissingRelationError(error: unknown, relation: string) {
  const e = error as any;
  const text = `${safeStr(e?.code)} ${safeStr(e?.message)} ${safeStr(e?.details)} ${safeStr(e?.hint)}`.toLowerCase();
  const target = relation.toLowerCase();
  return text.includes("42p01") || (text.includes(target) && (text.includes("does not exist") || text.includes("not found")));
}

/**
 * Returnerer aktiv avtale-status for en bedrift.
 *
 * - isActive = TRUE betyr at agreements.status er ACTIVE, lest via company_current_agreement.
 * - billingHold = TRUE betyr at company_billing_accounts har aktiv hold.
 *
 * Disse er separate dimensjoner:
 * - Aktiv avtale men billing hold: bedrift har gyldig avtale, men kan ikke bestille (faktura)
 * - Ingen aktiv avtale: bedrift har ikke fullført onboarding eller avtalen er PAUSED/CLOSED
 *
 * Operative gates skal sjekke BÅDE isActive OG ikke billingHold for å tillate bestilling.
 */
export async function getAgreementStatus(
  supabase: SupabaseClient,
  companyId: string,
): Promise<AgreementStatusResult> {
  const cid = safeStr(companyId);
  let agreement: any = null;

  if (cid) {
    try {
      const { data, error } = await (supabase as any)
        .from("company_current_agreement")
        .select("agreement_id,tier:plan_tier,status")
        .eq("company_id", cid)
        .maybeSingle();

      if (!error && data) {
        agreement = data;
      }
    } catch {
      agreement = null;
    }
  }

  let billingHold = false;
  if (cid) {
    try {
      const { data: billing, error } = await (supabase as any)
        .from("company_billing_accounts")
        .select("*")
        .eq("company_id", cid)
        .maybeSingle();

      if (error) {
        billingHold = isMissingRelationError(error, "company_billing_accounts") ? false : true;
      } else {
        billingHold = billing?.hold_active === true || billing?.billing_hold === true;
      }
    } catch (error) {
      billingHold = isMissingRelationError(error, "company_billing_accounts") ? false : true;
    }
  }

  const status = normalizeStatus(agreement?.status);

  return {
    agreementId: safeStr(agreement?.agreement_id) || null,
    tier: normalizeTier(agreement?.tier),
    dayTiers: { ...EMPTY_DAY_TIERS },
    status,
    isActive: status === "ACTIVE",
    billingHold,
  };
}

/**
 * Sjekker om bedriften kan utføre operative handlinger (bestille, avbestille).
 * Krever BÅDE aktiv avtale OG ingen billing hold.
 */
export function canCompanyOperate(status: AgreementStatusResult): boolean {
  return status.isActive && !status.billingHold;
}
