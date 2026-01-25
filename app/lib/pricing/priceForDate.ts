// lib/pricing/priceForDate.ts
import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { normalizeAgreement, resolveTierForDate } from "@/lib/agreements/normalizeAgreement";

/* =========================================================
   Types + priser (fasit)
========================================================= */

export type PlanTier = "BASIS" | "LUXUS";

export const PRICE_PER_TIER: Record<PlanTier, number> = {
  BASIS: 90,
  LUXUS: 130,
};

export type PriceForDateOk = {
  ok: true;
  tier: PlanTier;
  unit_price: number;
  agreement_id: string;
};

export type PriceForDateErr = {
  ok: false;
  error: "BAD_INPUT" | "DB_ERROR" | "NO_AGREEMENT" | "BAD_AGREEMENT" | "BAD_TIER";
  message: string;
  detail?: any;
};

export type PriceForDateRes = PriceForDateOk | PriceForDateErr;

/* =========================================================
   Helpers
========================================================= */

function isIsoDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));
}

function asPlanTier(v: any): PlanTier | null {
  const s = String(v ?? "").toUpperCase().trim();
  if (s === "BASIS" || s === "LUXUS") return s as PlanTier;
  return null;
}

/* =========================================================
   API
========================================================= */

/**
 * priceForCompanyDate(company_id, isoDate)
 * - Henter company_current_agreement
 * - Normaliserer avtale (samme fasit som resten av systemet)
 * - resolveTierForDate() avgjør tier for datoen
 * - returnerer unit_price basert på tier
 *
 * NB: Vi er defensive på typer her (DB-row kan være minimal/any).
 */
export async function priceForCompanyDate(company_id: string, isoDate: string): Promise<PriceForDateRes> {
  const cid = String(company_id ?? "").trim();
  const day = String(isoDate ?? "").trim();

  if (!cid) return { ok: false, error: "BAD_INPUT", message: "Mangler company_id" };
  if (!isIsoDate(day)) return { ok: false, error: "BAD_INPUT", message: "Ugyldig datoformat (forventer YYYY-MM-DD)" };

  const sb = await supabaseServer();

  const { data, error } = await sb
    .from("company_current_agreement")
    .select("*")
    .eq("company_id", cid)
    .maybeSingle();

  if (error) return { ok: false, error: "DB_ERROR", message: "Kunne ikke hente avtale", detail: error };
  if (!data) return { ok: false, error: "NO_AGREEMENT", message: "Ingen avtale funnet for firma" };

  let agreement: any;
  try {
    agreement = normalizeAgreement(data as any);
  } catch (e: any) {
    return { ok: false, error: "BAD_AGREEMENT", message: "Avtalen kunne ikke normaliseres", detail: e };
  }

  // resolveTierForDate kan returnere string/PlanTier – vi normaliserer strengt.
  const rawTier = resolveTierForDate(agreement as any, day);
  const tier = asPlanTier(rawTier);

  if (!tier) {
    return {
      ok: false,
      error: "BAD_TIER",
      message: "Kunne ikke løse plan-tier for dato (forventet BASIS/LUXUS)",
      detail: { rawTier },
    };
  }

  const unit_price = PRICE_PER_TIER[tier];
  const agreement_id = String(agreement?.id ?? "").trim();

  if (!agreement_id) {
    return { ok: false, error: "BAD_AGREEMENT", message: "Avtalen mangler id etter normalisering", detail: { agreement } };
  }

  return { ok: true, tier, unit_price, agreement_id };
}
