/**
 * Cross-sell engine capability: suggestCrossSellProducts.
 * Suggests cross-sell products from current product and catalog: complementary
 * (different category), same-category alternatives, and optional "often bought with" style.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "suggestCrossSellProducts";

const suggestCrossSellProductsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Cross-sell engine: suggests cross-sell products from current product and catalog. Returns complementary products (different category), same-category alternatives, with reason, priority, and CTA. Optionally exclude cart product IDs. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Suggest cross-sell products input",
    properties: {
      currentProduct: {
        type: "object",
        description: "Product being viewed or in focus",
        properties: {
          productId: { type: "string" },
          name: { type: "string" },
          category: { type: "string" },
        },
      },
      catalog: {
        type: "array",
        description: "Catalog of products to suggest (productId, name, category, price?)",
        items: {
          type: "object",
          required: ["name"],
          properties: {
            productId: { type: "string" },
            name: { type: "string" },
            category: { type: "string" },
            price: { type: "string" },
          },
        },
      },
      cartProductIds: {
        type: "array",
        description: "Product IDs already in cart (exclude from suggestions)",
        items: { type: "string" },
      },
      maxSuggestions: { type: "number", description: "Max suggestions (default: 6)" },
      locale: { type: "string", description: "Locale (nb | en) for copy" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Cross-sell product suggestions",
    required: ["suggestions", "summary", "generatedAt"],
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          required: ["productId", "productName", "reason", "priority", "crossSellType"],
          properties: {
            productId: { type: "string" },
            productName: { type: "string" },
            category: { type: "string" },
            price: { type: "string" },
            reason: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            ctaLabel: { type: "string" },
            crossSellType: { type: "string", enum: ["complementary", "same_category", "alternative"] },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is suggestions only; no catalog or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(suggestCrossSellProductsCapability);

export type CurrentProductContext = {
  productId?: string | null;
  name?: string | null;
  category?: string | null;
};

export type CrossSellCatalogItem = {
  productId?: string | null;
  name: string;
  category?: string | null;
  price?: string | null;
};

export type SuggestCrossSellProductsInput = {
  currentProduct?: CurrentProductContext | null;
  catalog?: CrossSellCatalogItem[] | null;
  cartProductIds?: string[] | null;
  maxSuggestions?: number | null;
  locale?: "nb" | "en" | null;
};

export type CrossSellSuggestion = {
  productId: string;
  productName: string;
  category?: string | null;
  price?: string | null;
  reason: string;
  priority: "high" | "medium" | "low";
  ctaLabel?: string | null;
  crossSellType: "complementary" | "same_category" | "alternative";
};

export type SuggestCrossSellProductsOutput = {
  suggestions: CrossSellSuggestion[];
  summary: string;
  generatedAt: string;
};

const DEFAULT_MAX_SUGGESTIONS = 6;

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Suggests cross-sell products from current product and catalog. Deterministic; no external calls.
 */
export function suggestCrossSellProducts(input: SuggestCrossSellProductsInput = {}): SuggestCrossSellProductsOutput {
  const current = input.currentProduct && typeof input.currentProduct === "object" ? input.currentProduct : {};
  const currentId = safeStr(current.productId);
  const currentName = safeStr(current.name);
  const currentCategory = safeStr(current.category).toLowerCase();

  const catalog = Array.isArray(input.catalog)
    ? input.catalog.filter(
        (c): c is CrossSellCatalogItem => c != null && typeof c === "object" && typeof (c as CrossSellCatalogItem).name === "string"
      )
    : [];

  const cartIds = new Set((Array.isArray(input.cartProductIds) ? input.cartProductIds : []).map((id) => String(id).trim()));
  const maxSuggestions = Math.min(12, Math.max(1, Math.floor(Number(input.maxSuggestions) ?? DEFAULT_MAX_SUGGESTIONS)));
  const isEn = input.locale === "en";

  const suggestions: CrossSellSuggestion[] = [];
  const seenIds = new Set<string>();

  const add = (
    item: CrossSellCatalogItem,
    reason: string,
    priority: CrossSellSuggestion["priority"],
    crossSellType: CrossSellSuggestion["crossSellType"],
    ctaLabel?: string
  ) => {
    const id = safeStr(item.productId) || `name:${safeStr(item.name)}`;
    if (seenIds.has(id)) return;
    if (currentId && id === currentId) return;
    if (cartIds.has(id)) return;
    if (suggestions.length >= maxSuggestions) return;

    seenIds.add(id);
    suggestions.push({
      productId: id,
      productName: safeStr(item.name) || (isEn ? "Product" : "Produkt"),
      category: item.category ? safeStr(item.category) : undefined,
      price: item.price ? safeStr(item.price) : undefined,
      reason,
      priority,
      ctaLabel: ctaLabel ?? undefined,
      crossSellType,
    });
  };

  const complementary = currentCategory
    ? catalog.filter((c) => safeStr(c.category).toLowerCase() !== currentCategory)
    : catalog;
  const sameCategory = currentCategory
    ? catalog.filter(
        (c) =>
          safeStr(c.category).toLowerCase() === currentCategory &&
          safeStr(c.name).toLowerCase() !== currentName.toLowerCase()
      )
    : [];

  for (const item of complementary) {
    add(
      item,
      isEn ? "Goes well with your selection; often bought together." : "Passer godt med valget ditt; ofte kjøpt sammen.",
      "high",
      "complementary",
      isEn ? "Add to cart" : "Legg i handlekurv"
    );
    if (suggestions.length >= maxSuggestions) break;
  }

  for (const item of sameCategory) {
    add(
      item,
      isEn ? "Others in the same category you might like." : "Andre i samme kategori du kanskje liker.",
      "medium",
      "same_category",
      isEn ? "View" : "Se"
    );
    if (suggestions.length >= maxSuggestions) break;
  }

  for (const item of catalog) {
    if (suggestions.length >= maxSuggestions) break;
    const cat = safeStr(item.category).toLowerCase();
    if (currentCategory && cat === currentCategory) continue;
    if (complementary.some((c) => (safeStr(c.productId) || safeStr(c.name)) === (safeStr(item.productId) || safeStr(item.name)))) continue;
    if (sameCategory.some((c) => (safeStr(c.productId) || safeStr(c.name)) === (safeStr(item.productId) || safeStr(item.name)))) continue;
    add(
      item,
      isEn ? "Popular choice; consider adding." : "Populært valg; vurder å legge til.",
      "low",
      "alternative",
      isEn ? "See option" : "Se alternativ"
    );
  }

  const summary =
    suggestions.length === 0
      ? isEn
        ? "No cross-sell suggestions. Add a catalog and current product for tailored suggestions."
        : "Ingen kryssalg-forslag. Legg til katalog og nåværende produkt for tilpassede forslag."
      : isEn
        ? `${suggestions.length} cross-sell suggestion(s) for ${currentName || "current product"}.`
        : `${suggestions.length} kryssalg-forslag for ${currentName || "nåværende produkt"}.`;

  return {
    suggestions,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { suggestCrossSellProductsCapability, CAPABILITY_NAME };
