/**
 * Upsell suggestion AI capability: suggestUpsells.
 * Suggests upsell products or offers from current context (product, category, cart) and optional catalog.
 * Returns suggested items with reason, priority, and optional CTA. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "suggestUpsells";

const suggestUpsellsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Upsell suggestion AI: suggests upsell products or offers from current context (product name, category, price or cart) and optional catalog. Returns suggested items with reason, priority, and CTA label. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Suggest upsells input",
    properties: {
      currentProduct: {
        type: "object",
        description: "Current product or cart context",
        properties: {
          name: { type: "string" },
          category: { type: "string" },
          price: { type: "string", description: "e.g. 299 kr/mnd" },
          productId: { type: "string" },
        },
      },
      catalog: {
        type: "array",
        description: "Optional catalog of products to suggest (name, price, category, productId)",
        items: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            price: { type: "string" },
            category: { type: "string" },
            productId: { type: "string" },
            description: { type: "string" },
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for copy" },
      maxSuggestions: { type: "number", description: "Max upsells to return (default 5)" },
      context: { type: "string", description: "Optional: checkout | product_page | cart | generic" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Upsell suggestions",
    required: ["suggestions", "summary"],
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          required: ["productName", "reason", "priority"],
          properties: {
            productName: { type: "string" },
            productId: { type: "string" },
            price: { type: "string" },
            category: { type: "string" },
            reason: { type: "string", description: "Why this upsell is suggested" },
            priority: { type: "string", description: "high | medium | low" },
            ctaLabel: { type: "string", description: "Suggested button/link text" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is upsell suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(suggestUpsellsCapability);

export type CurrentProductContext = {
  name?: string | null;
  category?: string | null;
  price?: string | null;
  productId?: string | null;
};

export type CatalogItem = {
  name: string;
  price?: string | null;
  category?: string | null;
  productId?: string | null;
  description?: string | null;
};

export type SuggestUpsellsInput = {
  currentProduct?: CurrentProductContext | null;
  catalog?: CatalogItem[] | null;
  locale?: "nb" | "en" | null;
  maxSuggestions?: number | null;
  context?: "checkout" | "product_page" | "cart" | "generic" | string | null;
};

export type UpsellSuggestion = {
  productName: string;
  productId?: string | null;
  price?: string | null;
  category?: string | null;
  reason: string;
  priority: "high" | "medium" | "low";
  ctaLabel?: string | null;
};

export type SuggestUpsellsOutput = {
  suggestions: UpsellSuggestion[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Suggests upsells from current product context and optional catalog. Deterministic; no external calls.
 */
export function suggestUpsells(input: SuggestUpsellsInput = {}): SuggestUpsellsOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const maxSuggestions = Math.min(10, Math.max(1, Math.floor(Number(input.maxSuggestions) ?? 5)));

  const current = input.currentProduct && typeof input.currentProduct === "object" ? input.currentProduct : {};
  const currentName = safeStr(current.name);
  const currentCategory = safeStr(current.category).toLowerCase();
  const currentId = safeStr(current.productId);

  const catalog = Array.isArray(input.catalog)
    ? input.catalog.filter(
        (c): c is CatalogItem =>
          c != null && typeof c === "object" && typeof (c as CatalogItem).name === "string"
      )
    : [];

  const suggestions: UpsellSuggestion[] = [];
  const seen = new Set<string>();

  const add = (
    productName: string,
    reason: string,
    priority: UpsellSuggestion["priority"],
    opts?: { productId?: string; price?: string; category?: string; ctaLabel?: string }
  ) => {
    const key = productName.toLowerCase();
    if (seen.has(key) || suggestions.length >= maxSuggestions) return;
    seen.add(key);
    if (currentName && key === currentName.toLowerCase()) return;
    if (currentId && opts?.productId === currentId) return;
    suggestions.push({
      productName,
      productId: opts?.productId ?? undefined,
      price: opts?.price ?? undefined,
      category: opts?.category ?? undefined,
      reason,
      priority,
      ctaLabel: opts?.ctaLabel ?? undefined,
    });
  };

  if (catalog.length > 0) {
    const sameCategory = currentCategory
      ? catalog.filter((c) => safeStr(c.category).toLowerCase() === currentCategory && safeStr(c.name).toLowerCase() !== currentName.toLowerCase())
      : catalog;
    const otherCategory = currentCategory
      ? catalog.filter((c) => safeStr(c.category).toLowerCase() !== currentCategory)
      : catalog;

    for (const item of sameCategory.slice(0, maxSuggestions)) {
      const name = safeStr(item.name) || (isEn ? "Product" : "Produkt");
      add(
        name,
        isEn ? "Same category; complements your choice." : "Samme kategori; komplementerer valget ditt.",
        "high",
        { productId: item.productId ?? undefined, price: item.price ?? undefined, category: item.category ?? undefined, ctaLabel: isEn ? "Add" : "Legg til" }
      );
    }
    for (const item of otherCategory) {
      if (suggestions.length >= maxSuggestions) break;
      const name = safeStr(item.name) || (isEn ? "Product" : "Produkt");
      add(
        name,
        isEn ? "Often combined with this type of product." : "Ofte kombinert med dette produktet.",
        "medium",
        { productId: item.productId ?? undefined, price: item.price ?? undefined, category: item.category ?? undefined, ctaLabel: isEn ? "See option" : "Se alternativ" }
      );
    }
  }

  const summary =
    suggestions.length === 0
      ? isEn
        ? "No upsell suggestions. Provide a product catalog for tailored upsells."
        : "Ingen oppsalg-forslag. Angi en produktkatalog for tilpassede oppsalg."
      : isEn
        ? `${suggestions.length} upsell suggestion(s) for ${currentName || "current context"}.`
        : `${suggestions.length} oppsalg-forslag for ${currentName || "nåværende kontekst"}.`;

  return {
    suggestions,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { suggestUpsellsCapability, CAPABILITY_NAME };
