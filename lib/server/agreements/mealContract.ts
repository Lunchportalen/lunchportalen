import type { CmsProductPlan } from "@/lib/cms/types";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";

export type MealPlanName = "basis" | "luxus";

export type StoredMealContract =
  | { plan: "basis"; delivery_days: string[]; fixed_meal_type: string }
  | { plan: "luxus"; delivery_days: string[]; menu_per_day: Record<string, string> };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function normContractDayKey(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "mon" || s === "tue" || s === "wed" || s === "thu" || s === "fri") return s;
  return null;
}

export function parseMealContractFromAgreementJson(agreementJson: unknown): StoredMealContract | null {
  if (!isPlainObject(agreementJson)) return null;
  const mc = (agreementJson as any).meal_contract;
  if (!isPlainObject(mc)) return null;
  const plan = String((mc as any).plan ?? "").trim().toLowerCase();
  const delivery = Array.isArray((mc as any).delivery_days)
    ? ((mc as any).delivery_days as unknown[]).map(normContractDayKey).filter(Boolean) as string[]
    : [];
  if (plan === "basis") {
    const fixed = normalizeMealTypeKey((mc as any).fixed_meal_type);
    if (!fixed || !delivery.length) return null;
    if (isPlainObject((mc as any).menu_per_day) && Object.keys((mc as any).menu_per_day).length) return null;
    return { plan: "basis", delivery_days: delivery, fixed_meal_type: fixed };
  }
  if (plan === "luxus" || plan === "luksus") {
    const mpd = (mc as any).menu_per_day;
    if (!isPlainObject(mpd)) return null;
    const menu_per_day: Record<string, string> = {};
    for (const [k, val] of Object.entries(mpd)) {
      const dk = normContractDayKey(k);
      const mv = normalizeMealTypeKey(val);
      if (!dk || !mv) return null;
      menu_per_day[dk] = mv;
    }
    if (!delivery.length) return null;
    return { plan: "luxus", delivery_days: delivery, menu_per_day };
  }
  return null;
}

function allowedSet(plan: CmsProductPlan | null): Set<string> | null {
  if (!plan?.allowedMeals?.length) return null;
  return new Set(plan.allowedMeals.map((x) => normalizeMealTypeKey(x)).filter(Boolean));
}

export function validateMealContractPayload(opts: {
  rpcTier: "BASIS" | "LUXUS";
  deliveryDays: string[];
  payload: unknown;
  cmsBasis: CmsProductPlan | null;
  cmsLuxus: CmsProductPlan | null;
}): { ok: true; normalized: StoredMealContract } | { ok: false; code: string; message: string } {
  const { rpcTier, deliveryDays, payload, cmsBasis, cmsLuxus } = opts;

  if (!isPlainObject(payload)) {
    return { ok: false, code: "MEAL_CONTRACT_INVALID", message: "meal_contract må være et objekt." };
  }

  const planRaw = String((payload as any).plan ?? "").trim().toLowerCase();
  const plan: MealPlanName | null =
    planRaw === "basis" ? "basis" : planRaw === "luxus" || planRaw === "luksus" ? "luxus" : null;
  if (!plan) return { ok: false, code: "MEAL_PLAN_INVALID", message: "Ugyldig plan (forventet basis eller luxus)." };

  if (rpcTier === "BASIS" && plan !== "basis") {
    return { ok: false, code: "MEAL_PLAN_TIER_MISMATCH", message: "Avtalenivå BASIS krever plan=basis." };
  }
  if (rpcTier === "LUXUS" && plan !== "luxus") {
    return { ok: false, code: "MEAL_PLAN_TIER_MISMATCH", message: "Avtalenivå LUXUS krever plan=luxus." };
  }

  const dd = deliveryDays.map(normContractDayKey).filter(Boolean) as string[];
  if (!dd.length) return { ok: false, code: "DELIVERY_DAYS_INVALID", message: "Leveringsdager mangler." };

  const cmsPlan = plan === "basis" ? cmsBasis : cmsLuxus;
  if (!cmsPlan) {
    return { ok: false, code: "CMS_PRODUCT_PLAN_MISSING", message: "CMS-produktplan mangler (kan ikke validere måltider)." };
  }

  const allowed = allowedSet(cmsPlan);
  if (!allowed?.size) {
    return { ok: false, code: "CMS_PRODUCT_PLAN_INCOMPLETE", message: "CMS-produktplan mangler allowedMeals." };
  }

  if (plan === "basis") {
    if (cmsPlan.rules.allowDailyVariation !== false) {
      return { ok: false, code: "CMS_PLAN_MISMATCH", message: "Basis-plan i CMS må ha rules.allowDailyVariation=false." };
    }
    const fixed = normalizeMealTypeKey((payload as any).fixed_meal_type);
    if (!fixed) return { ok: false, code: "FIXED_MEAL_MISSING", message: "fixed_meal_type er påkrevd for basis." };
    if (isPlainObject((payload as any).menu_per_day) && Object.keys((payload as any).menu_per_day).length) {
      return { ok: false, code: "BASIS_MENU_PER_DAY_FORBIDDEN", message: "Basis kan ikke ha menu_per_day." };
    }
    if (!allowed.has(fixed)) return { ok: false, code: "MEAL_TYPE_NOT_ALLOWED", message: "fixed_meal_type er ikke tillatt for plan." };
    return { ok: true, normalized: { plan: "basis", delivery_days: dd, fixed_meal_type: fixed } };
  }

  if (cmsPlan.rules.allowDailyVariation !== true) {
    return { ok: false, code: "CMS_PLAN_MISMATCH", message: "Luxus-plan i CMS må ha rules.allowDailyVariation=true." };
  }
  const mpdRaw = (payload as any).menu_per_day;
  if (!isPlainObject(mpdRaw)) {
    return { ok: false, code: "MENU_PER_DAY_REQUIRED", message: "menu_per_day er påkrevd for luxus." };
  }
  const fixedRaw = String((payload as any).fixed_meal_type ?? "").trim();
  if (fixedRaw.length) {
    return { ok: false, code: "LUXUS_FIXED_FORBIDDEN", message: "Luxus kan ikke bruke fixed_meal_type." };
  }

  const menu_per_day: Record<string, string> = {};
  for (const day of dd) {
    if (!(day in mpdRaw)) {
      return { ok: false, code: "MENU_PER_DAY_INCOMPLETE", message: `menu_per_day mangler ${day}.` };
    }
    const mv = normalizeMealTypeKey((mpdRaw as any)[day]);
    if (!mv) return { ok: false, code: "MENU_PER_DAY_INVALID", message: `Ugyldig måltid for ${day}.` };
    if (!allowed.has(mv)) return { ok: false, code: "MEAL_TYPE_NOT_ALLOWED", message: `Måltid ikke tillatt på ${day}.` };
    menu_per_day[day] = mv;
  }

  for (const k of Object.keys(mpdRaw)) {
    const dk = normContractDayKey(k);
    if (!dk) continue;
    if (!dd.includes(dk)) {
      return { ok: false, code: "MENU_PER_DAY_EXTRA_DAY", message: `menu_per_day inneholder dag utenfor levering: ${dk}.` };
    }
  }

  return { ok: true, normalized: { plan: "luxus", delivery_days: dd, menu_per_day } };
}

export function mergeMealContractIntoAgreementJson(
  existing: unknown,
  normalized: StoredMealContract | null
): Record<string, unknown> {
  const base = isPlainObject(existing) ? { ...existing } : {};
  if (!normalized) {
    const next = { ...base };
    delete next.meal_contract;
    return next;
  }
  return {
    ...base,
    meal_contract: normalized,
  };
}

export function resolveAgreementMealTypeForDay(opts: {
  dayKey: string;
  mealContract: StoredMealContract | null;
  legacyChoiceKey: string | null;
}): string | null {
  const dk = normContractDayKey(opts.dayKey);
  if (!dk) return null;
  const mc = opts.mealContract;
  if (!mc) {
    return opts.legacyChoiceKey ? normalizeMealTypeKey(opts.legacyChoiceKey) : null;
  }
  if (mc.plan === "basis") return normalizeMealTypeKey(mc.fixed_meal_type);
  const v = mc.menu_per_day[dk];
  if (v) return normalizeMealTypeKey(v);
  return opts.legacyChoiceKey ? normalizeMealTypeKey(opts.legacyChoiceKey) : null;
}
