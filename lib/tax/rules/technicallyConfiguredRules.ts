/**
 * Effective-dated TECHNICALLY_CONFIGURED tax rules for all 21 countries.
 * reviewStatus remains RESEARCHED — never APPROVED in this module.
 */

import type { TaxRuleRecord } from "@/lib/tax/engine/resolver";
import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";
import type { TaxCategoryCode } from "@/lib/tax/engine/resolver";

const CATEGORIES: readonly TaxCategoryCode[] = [
  "cold_food",
  "hot_food",
  "prepared_food",
  "restaurant_service",
  "catering_service",
  "staffed_catering",
  "takeaway",
  "delivery_fee",
  "service_fee",
  "platform_commission",
  "alcohol",
  "non_alcoholic_beverage",
  "gratuity",
  "packaging",
  "refundable_deposit",
  "discount",
  "credit_adjustment",
] as const;

type CountryRateProfile = {
  standardBps: number;
  foodBps: number;
  alcoholBps: number;
  zeroBpsCats?: TaxCategoryCode[];
  evidenceId: string;
  sourceNote: string;
};

/**
 * Researched rate profiles from official authority homes / TEDB / HMRC / Skatteetaten / CRA.
 * technical only — EXTERNAL_REVIEW_REQUIRED for legal approval.
 */
const PROFILES: Partial<Record<CountryCode, CountryRateProfile>> = {
  NO: { standardBps: 2500, foodBps: 1500, alcoholBps: 2500, evidenceId: "src-no-skatteetaten-mva-2026", sourceNote: "Skatteetaten 2026" },
  SE: { standardBps: 2500, foodBps: 1200, alcoholBps: 2500, evidenceId: "src-se-skatteverket", sourceNote: "Skatteverket/TEDB researched" },
  DK: { standardBps: 2500, foodBps: 2500, alcoholBps: 2500, evidenceId: "src-dk-skat", sourceNote: "Skattestyrelsen/TEDB researched" },
  FI: { standardBps: 2550, foodBps: 1400, alcoholBps: 2550, evidenceId: "src-fi-vero", sourceNote: "Vero/TEDB researched" },
  GB: {
    standardBps: 2000,
    foodBps: 0,
    alcoholBps: 2000,
    zeroBpsCats: ["cold_food", "gratuity", "refundable_deposit"],
    evidenceId: "src-gb-hmrc-709-1",
    sourceNote: "HMRC 709/1 researched",
  },
  DE: { standardBps: 1900, foodBps: 700, alcoholBps: 1900, evidenceId: "src-de-bmf", sourceNote: "BMF/TEDB researched" },
  FR: { standardBps: 2000, foodBps: 550, alcoholBps: 2000, evidenceId: "src-fr-dgfip", sourceNote: "DGFiP/TEDB researched" },
  ES: { standardBps: 2100, foodBps: 1000, alcoholBps: 2100, evidenceId: "src-es-aeat", sourceNote: "AEAT/TEDB researched" },
  IT: { standardBps: 2200, foodBps: 1000, alcoholBps: 2200, evidenceId: "src-it-ade", sourceNote: "AdE/TEDB researched" },
  NL: { standardBps: 2100, foodBps: 900, alcoholBps: 2100, evidenceId: "src-nl-bd", sourceNote: "Belastingdienst/TEDB researched" },
  BE: { standardBps: 2100, foodBps: 600, alcoholBps: 2100, evidenceId: "src-be-fin", sourceNote: "FPS Finance/TEDB researched" },
  CH: { standardBps: 810, foodBps: 260, alcoholBps: 810, evidenceId: "src-ch-estv", sourceNote: "ESTV researched" },
  AT: { standardBps: 2000, foodBps: 1000, alcoholBps: 2000, evidenceId: "src-at-bmf", sourceNote: "BMF/TEDB researched" },
  IE: { standardBps: 2300, foodBps: 1350, alcoholBps: 2300, evidenceId: "src-ie-revenue", sourceNote: "Revenue/TEDB researched" },
  PL: { standardBps: 2300, foodBps: 500, alcoholBps: 2300, evidenceId: "src-pl-mf", sourceNote: "MF/TEDB researched" },
  RO: { standardBps: 1900, foodBps: 900, alcoholBps: 1900, evidenceId: "src-ro-anaf", sourceNote: "ANAF/TEDB researched" },
  CZ: { standardBps: 2100, foodBps: 1200, alcoholBps: 2100, evidenceId: "src-cz-fs", sourceNote: "Finanční správa/TEDB researched" },
  PT: { standardBps: 2300, foodBps: 1300, alcoholBps: 2300, evidenceId: "src-pt-at", sourceNote: "AT/TEDB researched" },
  GR: { standardBps: 2400, foodBps: 1300, alcoholBps: 2400, evidenceId: "src-gr-aade", sourceNote: "AADE/TEDB researched" },
};

const FOOD_CATS = new Set<TaxCategoryCode>([
  "cold_food", "hot_food", "prepared_food", "takeaway", "packaging",
]);
const SERVICE_CATS = new Set<TaxCategoryCode>([
  "restaurant_service", "catering_service", "staffed_catering", "delivery_fee", "service_fee",
]);
const ZERO_CATS = new Set<TaxCategoryCode>(["gratuity", "refundable_deposit", "discount", "credit_adjustment"]);

function rateFor(profile: CountryRateProfile, cat: TaxCategoryCode): number {
  if (profile.zeroBpsCats?.includes(cat) || ZERO_CATS.has(cat)) return 0;
  if (cat === "alcohol") return profile.alcoholBps;
  if (FOOD_CATS.has(cat)) return profile.foodBps;
  if (SERVICE_CATS.has(cat) || cat === "platform_commission" || cat === "non_alcoholic_beverage") {
    return profile.standardBps;
  }
  return profile.standardBps;
}

function buildCountryRules(country: CountryCode): TaxRuleRecord[] {
  if (country === "US" || country === "CA") return []; // subdivision provider only
  const profile = PROFILES[country];
  if (!profile) return [];
  return CATEGORIES.map((cat) => ({
    id: `${country}-${cat}-TECH-2026`,
    countryCode: country,
    jurisdictionPath: country,
    taxCategory: cat,
    customerType: "any" as const,
    fulfillmentType: "any" as const,
    rateBps: rateFor(profile, cat),
    inclusive: false,
    reverseCharge: false,
    exemptionCode: rateFor(profile, cat) === 0 ? "ZERO_OR_OUT_OF_SCOPE" : null,
    taxCode: `${country}-${cat}`,
    invoiceWordingKey: `${country.toLowerCase()}.tax.${cat}`,
    evidenceId: profile.evidenceId,
    validFrom: "2026-01-01",
    validTo: null,
    reviewStatus: "RESEARCHED" as const,
  }));
}

function buildAllCountryRules(): Record<CountryCode, readonly TaxRuleRecord[]> {
  const out = {} as Record<CountryCode, readonly TaxRuleRecord[]>;
  for (const c of SUPPORTED_COUNTRY_CODES) {
    out[c] = buildCountryRules(c);
  }
  return out;
}

export const TECHNICALLY_CONFIGURED_RULES_BY_COUNTRY: Record<CountryCode, readonly TaxRuleRecord[]> =
  buildAllCountryRules();

export function allTechnicallyConfiguredRules(): TaxRuleRecord[] {
  return SUPPORTED_COUNTRY_CODES.flatMap((c) => [...TECHNICALLY_CONFIGURED_RULES_BY_COUNTRY[c]]);
}

export function countTechnicalTaxConfiguration(): {
  countriesWithRules: number;
  ruleCount: number;
  approved: number;
} {
  const all = allTechnicallyConfiguredRules();
  const countriesWithRules = SUPPORTED_COUNTRY_CODES.filter(
    (c) => c === "US" || c === "CA" || TECHNICALLY_CONFIGURED_RULES_BY_COUNTRY[c].length === CATEGORIES.length,
  ).length;
  return {
    countriesWithRules,
    ruleCount: all.length,
    approved: all.filter((r) => r.reviewStatus === "APPROVED").length,
  };
}
