import "server-only";

import { normalizeDeliveryDaysStrict } from "@/lib/agreements/deliveryDays";
import { validateMealContractForAgreementWrite } from "@/lib/server/agreements/submitAgreement";

export type LedgerAgreementValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function normTier(v: unknown): "BASIS" | "LUXUS" | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "BASIS" || s === "LUXUS") return s;
  return null;
}

/**
 * Read-only validation before ledger agreement (public.agreements) approval.
 * Fail-closed: CMS + meal_contract + delivery days must align.
 */
export async function validateLedgerAgreementForApproval(opts: {
  tier: unknown;
  delivery_days: unknown;
  price_per_employee: unknown;
  agreement_json: unknown;
}): Promise<LedgerAgreementValidationResult> {
  const tier = normTier(opts.tier);
  if (!tier) {
    return { ok: false, code: "TIER_INVALID", message: "Ugyldig plan (forventet BASIS eller LUXUS)." };
  }

  const price = Number(String(opts.price_per_employee ?? "").replace(",", "."));
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, code: "PRICE_INVALID", message: "Pris per ansatt mangler eller er ugyldig." };
  }

  const dd = normalizeDeliveryDaysStrict(opts.delivery_days);
  if (dd.unknown.length > 0 || dd.days.length === 0) {
    return { ok: false, code: "DELIVERY_DAYS_INVALID", message: "Leveringsdager er ugyldige eller mangler." };
  }

  if (!isPlainObject(opts.agreement_json)) {
    return { ok: false, code: "AGREEMENT_JSON_MISSING", message: "Firmaets avtale-JSON mangler (kan ikke validere meny)." };
  }

  const mealRaw = (opts.agreement_json as any).meal_contract;
  if (!isPlainObject(mealRaw)) {
    return { ok: false, code: "MEAL_CONTRACT_MISSING", message: "Meny (meal_contract) mangler i avtalen." };
  }

  const mealCheck = await validateMealContractForAgreementWrite({
    rpcTier: tier,
    deliveryDays: dd.days,
    mealContract: mealRaw,
  });

  if (mealCheck.ok === false) {
    return { ok: false, code: mealCheck.code, message: mealCheck.message };
  }

  if (mealCheck.ok === true && mealCheck.skip === true) {
    return { ok: false, code: "MEAL_CONTRACT_INCOMPLETE", message: "Meny (meal_contract) kunne ikke valideres." };
  }

  return { ok: true };
}
