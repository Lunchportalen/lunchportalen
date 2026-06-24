/**
 * Pure display helpers for provider/kitchen order cards (no server-only deps).
 */

import { displayLabelForMealTypeKey } from "@/lib/cms/mealTypeDisplayFallback";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";

export type VariantTitleLookup = Map<string, string>;

export type KitchenOrderChoiceContext = {
  choiceKey?: string | null;
  itemKey?: string | null;
  itemTitleSnapshot?: string | null;
  note?: string | null;
};

export type KitchenOrderItemDisplayInput = {
  productNameSnapshot?: string | null;
  quantity: number;
  choice?: KitchenOrderChoiceContext | null;
  variantLookup?: VariantTitleLookup;
};

export type KitchenOrderItemDisplay = {
  quantity: number;
  productName: string;
  choiceLabel: string | null;
  variantTitle: string | null;
  /** Null when no order line data — resolve via provider.orders.fallbacks.unknownProduct in UI. */
  displayLine: string | null;
  allergens: string[];
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function pickString(...vals: unknown[]): string | null {
  for (const v of vals) {
    const s = safeStr(v);
    if (s) return s;
  }
  return null;
}

/** Returns null when profile has no displayable name — resolve via provider.orders.fallbacks.unknownProfile in UI. */
export function profileDisplayName(profile: {
  full_name?: string | null;
  email?: string | null;
} | null | undefined): string | null {
  const full = pickString(profile?.full_name);
  if (full) return full;
  const email = pickString(profile?.email);
  if (email) return email.split("@")[0] ?? email;
  return null;
}

export function profileEmail(profile: { email?: string | null } | null | undefined): string | null {
  return pickString(profile?.email);
}

export function locationDisplayName(location: { name?: string | null } | null | undefined): string | null {
  return pickString(location?.name);
}

export function resolveChoiceLabel(choiceKey: string | null | undefined): string | null {
  const ck = safeStr(choiceKey).toLowerCase();
  if (!ck) return null;
  const nk = normalizeMealTypeKey(ck);
  return displayLabelForMealTypeKey(nk || ck) || null;
}

export function resolveVariantTitleFromLookup(
  choiceKey: string,
  itemKey: string | null | undefined,
  lookup: VariantTitleLookup,
): string | null {
  const ik = safeStr(itemKey).toLowerCase();
  if (!ik) return null;
  const nk = normalizeMealTypeKey(choiceKey);
  return lookup.get(`${nk}:${ik}`) ?? lookup.get(`${safeStr(choiceKey).toLowerCase()}:${ik}`) ?? null;
}

export function resolveVariantTitle(
  choice: KitchenOrderChoiceContext | null | undefined,
  variantLookup?: VariantTitleLookup,
): string | null {
  if (!choice) return null;
  const snap = pickString(choice.itemTitleSnapshot);
  if (snap) return snap;
  const ck = safeStr(choice.choiceKey);
  if (ck && choice.itemKey && variantLookup) {
    const fromLookup = resolveVariantTitleFromLookup(ck, choice.itemKey, variantLookup);
    if (fromLookup) return fromLookup;
  }
  return null;
}

/** Provider-facing line: `Påsmurt · Laks & Eggerøre`. Null when no line data. */
export function formatProviderOrderItemLine(params: {
  choiceLabel?: string | null;
  variantTitle?: string | null;
  productNameSnapshot?: string | null;
}): string | null {
  const choice = pickString(params.choiceLabel);
  const variant = pickString(params.variantTitle);
  const product = pickString(params.productNameSnapshot);

  if (choice && variant) return `${choice} · ${variant}`;
  if (variant) return variant;
  if (choice) return choice;
  if (product) return product;
  return null;
}

export function buildKitchenOrderItemDisplay(input: KitchenOrderItemDisplayInput): KitchenOrderItemDisplay {
  const choiceLabel = resolveChoiceLabel(input.choice?.choiceKey);
  const variantTitle = resolveVariantTitle(input.choice, input.variantLookup);
  const displayLine = formatProviderOrderItemLine({
    choiceLabel,
    variantTitle,
    productNameSnapshot: input.productNameSnapshot,
  });

  const productName = pickString(input.productNameSnapshot) ?? displayLine ?? "";

  return {
    quantity: input.quantity,
    productName,
    choiceLabel,
    variantTitle,
    displayLine,
    allergens: [],
  };
}

export function parseAllergensSnapshot(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((v) => safeStr(v)).filter(Boolean);
  }
  if (typeof raw === "object") {
    return Object.values(raw as Record<string, unknown>)
      .map((v) => safeStr(v))
      .filter(Boolean);
  }
  const s = safeStr(raw);
  return s ? [s] : [];
}

export function dayChoiceKey(params: {
  companyId: string;
  locationId: string | null;
  userId: string;
  date: string;
}) {
  return `${safeStr(params.companyId)}|${safeStr(params.locationId)}|${safeStr(params.userId)}|${safeStr(params.date)}`;
}
