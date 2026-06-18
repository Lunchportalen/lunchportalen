// lib/providers/providerMenuPackageSurface.ts
// Provider menu builder: package rules, Enterprise value, margin display (client-safe).

import {
  CATEGORY_LABELS,
  PLAN_CATEGORIES,
  PLAN_TIERS,
  type Category,
  type PlanTier,
} from "@/lib/cms/menuDayContract";

export const PROVIDER_MENU_BUILDER_COPY = {
  title: "Meny",
  lead: "Planlegg, vedlikehold og publiser menyer for Basis, Luxus og Enterprise.",
  status: {
    draft: "Utkast",
    published: "Publisert",
    missing: "Mangler dager",
    ready: "Klar til publisering",
  },
  allergensNone: "Ingen allergener oppgitt",
  allergensPrefix: "Allergener:",
  enterpriseWeakValue:
    "Enterprise bør ha tydelig merverdi sammenlignet med Luxus.",
  enterpriseLowMargin: "Denne Enterprise-retten kan gi lavere margin enn Luxus. Kontroller råvarekost.",
  enterpriseUpgradeRequired:
    "Enterprise som gjenbruker Basis/Luxus må ha upgrade-type eller upgrade-beskrivelse ved publisering.",
} as const;

export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: "Mandag",
  tue: "Tirsdag",
  wed: "Onsdag",
  thu: "Torsdag",
  fri: "Fredag",
};

export const ENTERPRISE_UPGRADE_TYPES = [
  "PREMIUM_PROTEIN",
  "EXTRA_SIDE",
  "DESSERT_FRUIT",
  "LARGER_PORTION",
  "PREMIUM_LABELING",
  "PRIORITY_DELIVERY",
  "OTHER",
] as const;

export type EnterpriseUpgradeType = (typeof ENTERPRISE_UPGRADE_TYPES)[number];

export const ENTERPRISE_UPGRADE_LABELS: Record<EnterpriseUpgradeType, string> = {
  PREMIUM_PROTEIN: "Premium protein",
  EXTRA_SIDE: "Ekstra tilbehør",
  DESSERT_FRUIT: "Dessert/frukt/snack",
  LARGER_PORTION: "Større porsjon",
  PREMIUM_LABELING: "Premium merking/kontroll",
  PRIORITY_DELIVERY: "Prioritert leveringsvindu",
  OTHER: "Egen/annet",
};

export type ProviderMenuSlotKey = `${string}:${PlanTier}:${Category}`;

export type ProviderMenuSlotState = {
  date: string;
  tier: PlanTier;
  category: Category;
  mealTitle: string;
  description: string;
  allergensText: string;
  estimatedCostPerPortion: number | null;
  sourcePackage: PlanTier | null;
  upgradeType: EnterpriseUpgradeType | null;
  upgradeNote: string;
  status: "empty" | "draft" | "published";
  docId?: string | null;
};

export type ProviderMenuPriceView = {
  priceExVatNok: number;
  vatRate: number;
  priceIncVatNok: number;
};

export type MarginEstimate = {
  priceExVatNok: number;
  estimatedCostNok: number | null;
  grossMarginNok: number | null;
  marginPercent: number | null;
};

export function slotKey(date: string, tier: PlanTier, category: Category): ProviderMenuSlotKey {
  return `${date}:${tier}:${category}`;
}

export function parseAllergensDisplay(allergens: string[] | null | undefined, allergensText?: string): string {
  const fromText = String(allergensText ?? "").trim();
  if (fromText) return `${PROVIDER_MENU_BUILDER_COPY.allergensPrefix} ${fromText}`;
  const list = Array.isArray(allergens) ? allergens.filter(Boolean) : [];
  if (list.length === 0) return PROVIDER_MENU_BUILDER_COPY.allergensNone;
  return `${PROVIDER_MENU_BUILDER_COPY.allergensPrefix} ${list.join(", ")}`;
}

export function computeMarginEstimate(
  price: ProviderMenuPriceView,
  estimatedCostPerPortion: number | null | undefined,
): MarginEstimate {
  const priceExVatNok = price.priceExVatNok;
  const cost =
    estimatedCostPerPortion != null && Number.isFinite(estimatedCostPerPortion) && estimatedCostPerPortion >= 0
      ? estimatedCostPerPortion
      : null;
  if (cost == null) {
    return { priceExVatNok, estimatedCostNok: null, grossMarginNok: null, marginPercent: null };
  }
  const grossMarginNok = Math.round((priceExVatNok - cost) * 100) / 100;
  const marginPercent = priceExVatNok > 0 ? Math.round((grossMarginNok / priceExVatNok) * 1000) / 10 : null;
  return { priceExVatNok, estimatedCostNok: cost, grossMarginNok, marginPercent };
}

export type EnterpriseValidationWarning = {
  code: "WEAK_VALUE" | "LOW_MARGIN" | "UPGRADE_REQUIRED";
  message: string;
  blocking: boolean;
};

export function validateEnterprisePublish(input: {
  tier: PlanTier;
  mealTitle: string;
  description: string;
  sourcePackage: PlanTier | null;
  upgradeType: EnterpriseUpgradeType | null;
  upgradeNote: string;
  estimatedCostPerPortion: number | null;
  luxusEstimatedCost: number | null;
  priceExVatNok: number;
}): EnterpriseValidationWarning[] {
  if (input.tier !== "ENTERPRISE") return [];

  const warnings: EnterpriseValidationWarning[] = [];
  const note = String(input.upgradeNote ?? "").trim();
  const hasUpgrade = Boolean(input.upgradeType) || note.length >= 8;

  if (input.sourcePackage && !hasUpgrade) {
    warnings.push({
      code: "UPGRADE_REQUIRED",
      message: PROVIDER_MENU_BUILDER_COPY.enterpriseUpgradeRequired,
      blocking: true,
    });
  }

  if (!input.sourcePackage && !hasUpgrade && input.mealTitle.trim()) {
    warnings.push({
      code: "WEAK_VALUE",
      message: PROVIDER_MENU_BUILDER_COPY.enterpriseWeakValue,
      blocking: false,
    });
  }

  if (
    input.estimatedCostPerPortion != null &&
    input.luxusEstimatedCost != null &&
    input.estimatedCostPerPortion >= input.luxusEstimatedCost &&
    input.priceExVatNok > 0
  ) {
    const margin = computeMarginEstimate(
      { priceExVatNok: input.priceExVatNok, vatRate: 0.15, priceIncVatNok: 0 },
      input.estimatedCostPerPortion,
    );
    const luxusMargin = computeMarginEstimate(
      { priceExVatNok: 130, vatRate: 0.15, priceIncVatNok: 0 },
      input.luxusEstimatedCost,
    );
    if (
      margin.grossMarginNok != null &&
      luxusMargin.grossMarginNok != null &&
      margin.grossMarginNok < luxusMargin.grossMarginNok
    ) {
      warnings.push({
        code: "LOW_MARGIN",
        message: PROVIDER_MENU_BUILDER_COPY.enterpriseLowMargin,
        blocking: false,
      });
    }
  }

  return warnings;
}

export function categoriesForTier(tier: PlanTier): Category[] {
  return PLAN_CATEGORIES[tier] ?? [];
}

export function isValidPlanTier(value: unknown): value is PlanTier {
  return PLAN_TIERS.includes(String(value ?? "").trim().toUpperCase() as PlanTier);
}

export function weekDatesFromStart(weekStartIso: string): string[] {
  const base = String(weekStartIso ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return [];
  const [y, m, d] = base.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  return WEEKDAY_KEYS.map((_, i) => {
    const dt = new Date(start);
    dt.setUTCDate(start.getUTCDate() + i);
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  });
}

export function summarizeWeekStatus(slots: ReadonlyArray<ProviderMenuSlotState>): string {
  const filled = slots.filter((s) => s.status !== "empty");
  if (filled.length === 0) return PROVIDER_MENU_BUILDER_COPY.status.missing;
  const published = filled.filter((s) => s.status === "published").length;
  if (published === filled.length && filled.length > 0) return PROVIDER_MENU_BUILDER_COPY.status.ready;
  if (published > 0) return PROVIDER_MENU_BUILDER_COPY.status.published;
  return PROVIDER_MENU_BUILDER_COPY.status.draft;
}

export function categoryLabel(category: Category): string {
  return CATEGORY_LABELS[category] ?? category;
}
