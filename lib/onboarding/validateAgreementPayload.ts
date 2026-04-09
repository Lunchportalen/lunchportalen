import type { AgreementPayload, LocationDraft, WeekdayKey } from "@/lib/onboarding/types";
import { WEEKDAY_ORDER } from "@/lib/onboarding/types";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";
import { LEGACY_BASIS_MEAL_SET, LEGACY_LUXUS_MEAL_SET } from "@/lib/cms/mealTierFallback";

function isWeekdayKey(v: string): v is WeekdayKey {
  return v === "mon" || v === "tue" || v === "wed" || v === "thu" || v === "fri";
}

function sortedUniqueDays(days: string[]): WeekdayKey[] {
  const set = new Set<WeekdayKey>();
  for (const d of days) {
    if (isWeekdayKey(d)) set.add(d);
  }
  return WEEKDAY_ORDER.filter((d) => set.has(d));
}

function locationIssues(locations: unknown, prefix: string): string[] {
  const issues: string[] = [];
  if (!Array.isArray(locations) || locations.length === 0) {
    issues.push(`${prefix}: minst én lokasjon er påkrevd.`);
    return issues;
  }
  (locations as LocationDraft[]).forEach((loc, i) => {
    const n = String(loc?.name ?? "").trim();
    const a = String(loc?.address ?? "").trim();
    if (!n) issues.push(`${prefix}: lokasjon ${i + 1} mangler navn.`);
    if (!a) issues.push(`${prefix}: lokasjon ${i + 1} mangler adresse.`);
  });
  return issues;
}

export type AgreementAllowlists = {
  basisMeals: string[];
  luxusMeals: string[];
};

function mealAllowedBasis(key: string, allowed: Set<string> | null): boolean {
  const nk = normalizeMealTypeKey(key);
  if (!nk) return false;
  if (allowed?.size) return allowed.has(nk);
  return LEGACY_BASIS_MEAL_SET.has(nk);
}

function mealAllowedLuxus(key: string, allowed: Set<string> | null): boolean {
  const nk = normalizeMealTypeKey(key);
  if (!nk) return false;
  if (allowed?.size) return allowed.has(nk);
  return LEGACY_LUXUS_MEAL_SET.has(nk);
}

/**
 * Streng validering før submitAgreement — ingen nettverk.
 * Når `allowlists` er satt, brukes CMS `allowedMeals` som referanse; ellers legacy luxus-nøkler (mealTierFallback).
 */
export function validateAgreementPayload(payload: unknown, allowlists?: AgreementAllowlists | null): string[] {
  const issues: string[] = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return ["Ugyldig nyttelast."];
  }
  const p = payload as Record<string, unknown>;
  const plan = p.plan;
  if (plan !== "basis" && plan !== "luxus") {
    issues.push("Velg Basis eller Luxus.");
    return issues;
  }

  const basisAllowed =
    allowlists?.basisMeals?.length ?
      new Set(allowlists.basisMeals.map((x) => normalizeMealTypeKey(x)).filter(Boolean))
    : null;
  const luxusAllowed =
    allowlists?.luxusMeals?.length ?
      new Set(allowlists.luxusMeals.map((x) => normalizeMealTypeKey(x)).filter(Boolean))
    : null;

  const deliveryRaw = p.delivery_days;
  if (!Array.isArray(deliveryRaw)) {
    issues.push("Leveringsdager mangler.");
    return issues;
  }
  const delivery_days = sortedUniqueDays(deliveryRaw.map((x) => String(x)));
  if (delivery_days.length === 0) {
    issues.push("Velg minst én leveringsdag.");
  }
  if (delivery_days.length > 5) {
    issues.push("Maksimum fem leveringsdager.");
  }

  issues.push(...locationIssues(p.locations, "Lokasjon"));

  if (plan === "basis") {
    const fm = p.fixed_meal_type;
    if (!mealAllowedBasis(String(fm ?? ""), basisAllowed)) {
      issues.push("Velg nøyaktig én gyldig meny for Basis.");
    }
    if (p.menu_per_day != null && typeof p.menu_per_day === "object" && Object.keys(p.menu_per_day as object).length) {
      issues.push("Basis kan ikke ha menu_per_day.");
    }
  } else {
    const mpd = p.menu_per_day;
    if (!mpd || typeof mpd !== "object" || Array.isArray(mpd)) {
      issues.push("Luxus krever meny per dag.");
    } else {
      const allowed = luxusAllowed;
      for (const d of delivery_days) {
        const v = (mpd as Record<string, unknown>)[d];
        const s = String(v ?? "").trim();
        if (!s || !mealAllowedLuxus(s, allowed)) {
          issues.push(`Velg gyldig måltid for ${d}.`);
        }
      }
      for (const k of Object.keys(mpd as object)) {
        if (!isWeekdayKey(k)) continue;
        if (!delivery_days.includes(k)) {
          issues.push(`Meny er satt for dag utenfor levering (${k}).`);
        }
      }
    }
    if (p.fixed_meal_type != null && String(p.fixed_meal_type).trim() !== "") {
      issues.push("Luxus kan ikke bruke fixed_meal_type.");
    }
  }

  return issues;
}

export function assertValidPayload(payload: unknown, allowlists?: AgreementAllowlists | null): AgreementPayload {
  const issues = validateAgreementPayload(payload, allowlists);
  if (issues.length) {
    throw new Error(issues.join(" "));
  }
  return payload as AgreementPayload;
}
