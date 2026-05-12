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
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri"] as const;
const TIERS: Tier[] = ["BASIS", "LUXUS", "ENTERPRISE"];

function emptyDayTiers(): AgreementDayTiers {
  return { ...EMPTY_DAY_TIERS };
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeTier(v: unknown): AgreementStatusResult["tier"] {
  const s = safeStr(v).toUpperCase();
  if (s === "BASIS" || s === "LUXUS" || s === "ENTERPRISE") return s;
  return null;
}

function isDayKey(v: unknown): v is DayKey {
  return (DAY_KEYS as readonly string[]).includes(safeStr(v));
}

function isMissingTierDayRead(error: unknown) {
  const e = error as any;
  const code = safeStr(e?.code).toUpperCase();
  return code === "42703" || code === "42P01";
}

function normalizeDayTiers(rows: unknown): AgreementDayTiers {
  const dayTiers = emptyDayTiers();

  if (!Array.isArray(rows)) return dayTiers;

  for (const row of rows) {
    const weekday = (row as any)?.weekday;
    if (!isDayKey(weekday)) continue;

    const tier = normalizeTier((row as any)?.tier);
    if (!tier) continue;

    dayTiers[weekday] = tier;
  }

  return dayTiers;
}

function primaryTierFromDayTiers(dayTiers: AgreementDayTiers): Tier | null {
  const counts: Record<Tier, number> = {
    BASIS: 0,
    LUXUS: 0,
    ENTERPRISE: 0,
  };

  for (const tier of Object.values(dayTiers)) {
    if (tier) counts[tier] += 1;
  }

  let primary: Tier | null = null;
  for (const tier of TIERS) {
    if (counts[tier] === 0) continue;
    if (!primary || counts[tier] >= counts[primary]) {
      primary = tier;
    }
  }

  return primary;
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

  const agreementId = safeStr(agreement?.agreement_id) || null;
  let dayTiers = emptyDayTiers();

  if (agreementId) {
    try {
      const { data: dayRows, error: dayErr } = await (supabase as any)
        .from("agreement_delivery_days")
        .select("weekday, tier")
        .eq("agreement_id", agreementId);

      if (dayErr) {
        if (isMissingTierDayRead(dayErr)) {
          console.warn("[agreementStatus] agreement_delivery_days tier read unavailable", dayErr);
        }
      } else {
        dayTiers = normalizeDayTiers(dayRows);
      }
    } catch (error) {
      if (isMissingTierDayRead(error)) {
        console.warn("[agreementStatus] agreement_delivery_days tier read unavailable", error);
      }
      dayTiers = emptyDayTiers();
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
  const primaryTier = primaryTierFromDayTiers(dayTiers) ?? normalizeTier(agreement?.tier);

  return {
    agreementId,
    tier: primaryTier,
    dayTiers,
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
