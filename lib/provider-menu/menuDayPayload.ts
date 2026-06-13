import "server-only";

import {
  CATEGORIES,
  PLAN_CATEGORIES,
  PLAN_TIERS,
  type Category,
  type PlanTier,
} from "@/lib/cms/menuDayContract";
import { MELHUS_PROVIDER_SANITY_ID } from "@/lib/cms/providerSanityConstants";

export type MenuDayStatus = "draft" | "published";

export type MenuDayInput = {
  date: string;
  tier: string;
  category: string;
  mealTitle: string;
  description: string;
  allergensText?: string | null;
  status: MenuDayStatus;
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
  approvedForPublish: boolean;
  customerVisible: boolean;
  approvedAt?: string;
  customerVisibleSetAt?: string;
};

export type MenuDayPayloadResult =
  | { ok: true; payload: SanityMenuDayPayload; docId: string; status: MenuDayStatus }
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

  const mealTitle = safeTrim(input.mealTitle, 120);
  if (!mealTitle) {
    return { ok: false, error: "Rettens navn er påkrevd.", field: "mealTitle" };
  }
  if (mealTitle.length < 2) {
    return { ok: false, error: "Rettens navn må være minst 2 tegn.", field: "mealTitle" };
  }

  const description = safeTrim(input.description, 4000);
  if (!description) {
    return { ok: false, error: "Beskrivelse er påkrevd.", field: "description" };
  }

  const status = parseStatus(input.status);
  if (!status) {
    return { ok: false, error: "Status må være «draft» eller «published».", field: "status" };
  }

  const allergens = parseAllergensText(input.allergensText);
  const now = new Date().toISOString();
  const isPublished = status === "published";

  const docId = buildMenuDayDocId(providerId, date, tier, category);

  const payload: SanityMenuDayPayload = {
    _id: docId,
    _type: "menuDay",
    provider: { _type: "reference", _ref: providerId },
    date,
    planTier: tier,
    category,
    mealTitle,
    description,
    approvedForPublish: isPublished,
    customerVisible: isPublished,
  };

  if (allergens) {
    payload.allergens = allergens;
  }

  if (isPublished) {
    payload.approvedAt = now;
    payload.customerVisibleSetAt = now;
  }

  return { ok: true, payload, docId, status };
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
  };
}
