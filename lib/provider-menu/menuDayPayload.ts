import "server-only";

import {
  CATEGORIES,
  PLAN_CATEGORIES,
  PLAN_TIERS,
  type Category,
  type PlanTier,
} from "@/lib/cms/menuDayContract";
import { MELHUS_PROVIDER_SANITY_ID } from "@/lib/cms/providerSanityConstants";
import {
  ENTERPRISE_UPGRADE_TYPES,
  validateEnterprisePublish,
  type EnterpriseUpgradeType,
} from "@/lib/providers/providerMenuPackageSurface";
import { fallbackProviderMenuPrices } from "@/lib/providers/providerMenuPriceConfig";

export type MenuDayStatus = "draft" | "published";

export type MenuDayInput = {
  date: string;
  tier: string;
  category: string;
  mealTitle: string;
  description: string;
  allergensText?: string | null;
  status: MenuDayStatus;
  estimatedCostPerPortion?: number | null;
  sourcePackage?: string | null;
  upgradeType?: string | null;
  upgradeNote?: string | null;
  confirmWarnings?: boolean;
  luxusEstimatedCost?: number | null;
};

export type SanityMenuDayPayload = {
  _id: string;
  _type: "menuDay";
  provider: { _type: "reference"; _ref: string };
  date: string;
  planTier: PlanTier;
  category: Category;
  mealTitle: string;
  description: string;
  allergens?: string[];
  estimatedCostPerPortion?: number;
  enterpriseSourcePackage?: string;
  enterpriseUpgradeType?: string;
  enterpriseUpgradeNote?: string;
  approvedForPublish: boolean;
  customerVisible: boolean;
  approvedAt?: string;
  customerVisibleSetAt?: string;
};

export type MenuDayPayloadResult =
  | { ok: true; payload: SanityMenuDayPayload; docId: string; status: MenuDayStatus; warnings?: string[] }
  | { ok: false; error: string; field?: string };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MENU_DAY_STATUSES: MenuDayStatus[] = ["draft", "published"];

function safeTrim(v: unknown, maxLen: number): string {
  return String(v ?? "").trim().slice(0, maxLen);
}

function parseTier(raw: unknown): PlanTier | null {
  const tier = String(raw ?? "").trim().toUpperCase();
  return PLAN_TIERS.includes(tier as PlanTier) ? (tier as PlanTier) : null;
}

function parseCategory(raw: unknown): Category | null {
  const category = String(raw ?? "").trim().toLowerCase();
  return CATEGORIES.includes(category as Category) ? (category as Category) : null;
}

function parseStatus(raw: unknown): MenuDayStatus | null {
  const status = String(raw ?? "").trim().toLowerCase();
  return MENU_DAY_STATUSES.includes(status as MenuDayStatus) ? (status as MenuDayStatus) : null;
}

function parseAllergensText(text: string | null | undefined): string[] | undefined {
  const raw = String(text ?? "").trim();
  if (!raw) return undefined;
  const parts = raw
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 32)
    .map((p) => p.slice(0, 64));
  return parts.length ? parts : undefined;
}

function parseEstimatedCost(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 90) return null;
  return Math.round(n * 100) / 100;
}

function parseUpgradeType(raw: unknown): EnterpriseUpgradeType | null {
  const v = String(raw ?? "").trim().toUpperCase();
  return ENTERPRISE_UPGRADE_TYPES.includes(v as EnterpriseUpgradeType) ? (v as EnterpriseUpgradeType) : null;
}

/**
 * Deterministic menuDay document id per provider.
 * Melhus retains legacy id shape without provider segment (continuity rule).
 */
export function buildMenuDayDocId(
  providerId: string,
  date: string,
  tier: PlanTier,
  category: Category,
): string {
  const pid = safeTrim(providerId, 64);
  if (pid === MELHUS_PROVIDER_SANITY_ID) {
    return `menuDay-${date}-${tier}-${category}`;
  }
  return `menuDay-${pid}-${date}-${tier}-${category}`;
}

/**
 * Validate provider menu editor input and build a Sanity menuDay payload.
 * Provider id is always supplied server-side — never from client body.
 */
export function buildMenuDayPayload(
  serverProviderId: string,
  input: MenuDayInput,
): MenuDayPayloadResult {
  const providerId = safeTrim(serverProviderId, 64);
  if (!providerId) {
    return { ok: false, error: "Leverandør kunne ikke identifiseres.", field: "provider" };
  }

  const date = safeTrim(input.date, 10);
  if (!date) {
    return { ok: false, error: "Dato er påkrevd.", field: "date" };
  }
  if (!ISO_DATE_RE.test(date)) {
    return { ok: false, error: "Dato må være på formatet YYYY-MM-DD.", field: "date" };
  }

  const tier = parseTier(input.tier);
  if (!tier) {
    return {
      ok: false,
      error: `Ugyldig plan. Gyldige verdier: ${PLAN_TIERS.join(", ")}.`,
      field: "tier",
    };
  }

  const category = parseCategory(input.category);
  if (!category) {
    return {
      ok: false,
      error: `Ugyldig kategori. Gyldige verdier: ${CATEGORIES.join(", ")}.`,
      field: "category",
    };
  }

  const allowedCategories = PLAN_CATEGORIES[tier];
  if (!allowedCategories.includes(category)) {
    return {
      ok: false,
      error: `Kategorien «${category}» er ikke tilgjengelig for plan ${tier}.`,
      field: "category",
    };
  }

  const status = parseStatus(input.status);
  if (!status) {
    return { ok: false, error: "Status må være «draft» eller «published».", field: "status" };
  }

  const isPublished = status === "published";
  const mealTitle = safeTrim(input.mealTitle, 120);
  const description = safeTrim(input.description, 4000);

  if (isPublished) {
    if (!mealTitle) {
      return { ok: false, error: "Rettens navn er påkrevd ved publisering.", field: "mealTitle" };
    }
    if (mealTitle.length < 2) {
      return { ok: false, error: "Rettens navn må være minst 2 tegn.", field: "mealTitle" };
    }
    if (!description) {
      return { ok: false, error: "Beskrivelse er påkrevd ved publisering.", field: "description" };
    }
  } else if (mealTitle && mealTitle.length < 2) {
    return { ok: false, error: "Rettens navn må være minst 2 tegn.", field: "mealTitle" };
  }

  const sourcePackage = parseTier(input.sourcePackage);
  const upgradeType = parseUpgradeType(input.upgradeType);
  const upgradeNote = safeTrim(input.upgradeNote, 500);
  const estimatedCostPerPortion = parseEstimatedCost(input.estimatedCostPerPortion);
  const luxusEstimatedCost = parseEstimatedCost(input.luxusEstimatedCost);
  const priceExVatNok = fallbackProviderMenuPrices()[tier].priceExVatNok;

  const enterpriseWarnings = validateEnterprisePublish({
    tier,
    mealTitle,
    description,
    sourcePackage,
    upgradeType,
    upgradeNote,
    estimatedCostPerPortion,
    luxusEstimatedCost,
    priceExVatNok,
  });

  const blocking = enterpriseWarnings.filter((w) => w.blocking);
  if (isPublished && blocking.length > 0) {
    return { ok: false, error: blocking[0]!.message, field: "upgradeNote" };
  }

  const softWarnings = enterpriseWarnings.filter((w) => !w.blocking).map((w) => w.message);
  if (isPublished && softWarnings.length > 0 && !input.confirmWarnings) {
    return {
      ok: false,
      error: `${softWarnings[0]} Bekreft for å publisere likevel.`,
      field: "confirmWarnings",
    };
  }

  const allergens = parseAllergensText(input.allergensText);
  const now = new Date().toISOString();
  const docId = buildMenuDayDocId(providerId, date, tier, category);

  const payload: SanityMenuDayPayload = {
    _id: docId,
    _type: "menuDay",
    provider: { _type: "reference", _ref: providerId },
    date,
    planTier: tier,
    category,
    mealTitle: mealTitle || "Utkast",
    description: description || "Utkast — ikke publisert.",
    approvedForPublish: isPublished,
    customerVisible: isPublished,
  };

  if (allergens) payload.allergens = allergens;
  if (estimatedCostPerPortion != null) payload.estimatedCostPerPortion = estimatedCostPerPortion;
  if (sourcePackage) payload.enterpriseSourcePackage = sourcePackage;
  if (upgradeType) payload.enterpriseUpgradeType = upgradeType;
  if (upgradeNote) payload.enterpriseUpgradeNote = upgradeNote;

  if (isPublished) {
    payload.approvedAt = now;
    payload.customerVisibleSetAt = now;
  }

  return {
    ok: true,
    payload,
    docId,
    status,
    warnings: softWarnings.length > 0 ? softWarnings : undefined,
  };
}

export function parseMenuDayRequestBody(raw: unknown): MenuDayInput | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const status = parseStatus(o.status);
  if (!status) return null;
  return {
    date: safeTrim(o.date, 10),
    tier: safeTrim(o.tier, 32),
    category: safeTrim(o.category, 32),
    mealTitle: safeTrim(o.mealTitle, 120),
    description: safeTrim(o.description, 4000),
    allergensText: o.allergensText != null ? safeTrim(o.allergensText, 2000) : null,
    status,
    estimatedCostPerPortion: parseEstimatedCost(o.estimatedCostPerPortion),
    sourcePackage: o.sourcePackage != null ? safeTrim(o.sourcePackage, 32) : null,
    upgradeType: o.upgradeType != null ? safeTrim(o.upgradeType, 64) : null,
    upgradeNote: o.upgradeNote != null ? safeTrim(o.upgradeNote, 500) : null,
    confirmWarnings: Boolean(o.confirmWarnings),
    luxusEstimatedCost: parseEstimatedCost(o.luxusEstimatedCost),
  };
}
