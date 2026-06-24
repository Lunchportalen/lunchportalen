// lib/providers/providerMenuPackageSurface.ts
// Provider menu builder: package rules, Enterprise value, margin display (client-safe).

import {
  CATEGORY_LABELS,
  PLAN_CATEGORIES,
  PLAN_TIERS,
  type Category,
  type PlanTier,
} from "@/lib/cms/menuDayContract";

export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

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

export type WeekPublishSummaryKey = "missing" | "ready" | "published" | "draft";

export type EnterpriseValidationMessageKey = "upgradeRequired" | "weakValue" | "lowMargin";

export type EnterpriseValidationWarning = {
  code: "WEAK_VALUE" | "LOW_MARGIN" | "UPGRADE_REQUIRED";
  messageKey: EnterpriseValidationMessageKey;
  /** Server/API nb fallback — provider UI uses messageKey + i18n. */
  message: string;
  blocking: boolean;
};

export function slotKey(date: string, tier: PlanTier, category: Category): ProviderMenuSlotKey {
  return `${date}:${tier}:${category}`;
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
      messageKey: "upgradeRequired",
      message:
        "Enterprise som gjenbruker Basis/Luxus må ha upgrade-type eller upgrade-beskrivelse ved publisering.",
      blocking: true,
    });
  }

  if (!input.sourcePackage && !hasUpgrade && input.mealTitle.trim()) {
    warnings.push({
      code: "WEAK_VALUE",
      messageKey: "weakValue",
      message: "Enterprise bør ha tydelig merverdi sammenlignet med Luxus.",
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
      { priceExVatNok: input.priceExVatNok, vatRate: 0, priceIncVatNok: 0 },
      input.estimatedCostPerPortion,
    );
    const luxusMargin = computeMarginEstimate(
      { priceExVatNok: 130, vatRate: 0, priceIncVatNok: 0 },
      input.luxusEstimatedCost,
    );
    if (
      margin.grossMarginNok != null &&
      luxusMargin.grossMarginNok != null &&
      margin.grossMarginNok < luxusMargin.grossMarginNok
    ) {
      warnings.push({
        code: "LOW_MARGIN",
        messageKey: "lowMargin",
        message: "Denne Enterprise-retten kan gi lavere margin enn Luxus. Kontroller råvarekost.",
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

export function summarizeWeekStatusKey(slots: ReadonlyArray<ProviderMenuSlotState>): WeekPublishSummaryKey {
  const filled = slots.filter((s) => s.status !== "empty");
  if (filled.length === 0) return "missing";
  const published = filled.filter((s) => s.status === "published").length;
  if (published === filled.length && filled.length > 0) return "ready";
  if (published > 0) return "published";
  return "draft";
}

export function categoryLabel(category: Category): string {
  return CATEGORY_LABELS[category] ?? category;
}

export type AllergensDisplayInput = {
  allergens: string[] | null | undefined;
  allergensText?: string;
};

export type AllergensDisplayResult =
  | { kind: "none" }
  | { kind: "list"; list: string }
  | { kind: "text"; text: string };

export function resolveAllergensDisplay(
  allergens: string[] | null | undefined,
  allergensText?: string,
): AllergensDisplayResult {
  const fromText = String(allergensText ?? "").trim();
  if (fromText) return { kind: "text", text: fromText };
  const list = Array.isArray(allergens) ? allergens.filter(Boolean) : [];
  if (list.length === 0) return { kind: "none" };
  return { kind: "list", list: list.join(", ") };
}
