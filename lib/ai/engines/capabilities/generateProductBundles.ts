/**
 * Product bundling AI capability: generateProductBundles.
 * Suggests product bundles from a catalog: same-category value packs and
 * cross-category combos, with suggested bundle name and discount. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "generateProductBundles";

const generateProductBundlesCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Product bundling AI: from a catalog (productId, name, category, price), suggests bundles: same-category value packs and cross-category combos. Returns productIds, suggested bundle name, discount percent, rationale, and priority. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Generate product bundles input",
    properties: {
      products: {
        type: "array",
        description: "Catalog: productId, name, category?, price? (numeric)",
        items: {
          type: "object",
          required: ["productId", "name"],
          properties: {
            productId: { type: "string" },
            name: { type: "string" },
            category: { type: "string" },
            price: { type: "number" },
          },
        },
      },
      maxBundleSize: {
        type: "number",
        description: "Max products per bundle (default: 3)",
      },
      maxBundles: {
        type: "number",
        description: "Max bundles to return (default: 10)",
      },
      excludeProductIds: {
        type: "array",
        description: "Product IDs to exclude from bundling (e.g. already in a bundle)",
        items: { type: "string" },
      },
      locale: { type: "string", description: "Locale (nb | en) for bundle names" },
    },
    required: ["products"],
  },
  outputSchema: {
    type: "object",
    description: "Generated product bundles",
    required: ["bundles", "summary", "generatedAt"],
    properties: {
      bundles: {
        type: "array",
        items: {
          type: "object",
          required: ["productIds", "productNames", "suggestedBundleName", "rationale", "priority"],
          properties: {
            productIds: { type: "array", items: { type: "string" } },
            productNames: { type: "array", items: { type: "string" } },
            suggestedBundleName: { type: "string" },
            suggestedPriceDiscountPercent: { type: "number" },
            totalPrice: { type: "number" },
            rationale: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            bundleType: { type: "string", description: "same_category | cross_category" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is bundle suggestions only; no catalog or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(generateProductBundlesCapability);

export type BundleProductInput = {
  productId: string;
  name: string;
  category?: string | null;
  price?: number | null;
};

export type GenerateProductBundlesInput = {
  products: BundleProductInput[];
  maxBundleSize?: number | null;
  maxBundles?: number | null;
  excludeProductIds?: string[] | null;
  locale?: "nb" | "en" | null;
};

export type ProductBundle = {
  productIds: string[];
  productNames: string[];
  suggestedBundleName: string;
  suggestedPriceDiscountPercent?: number | null;
  totalPrice?: number | null;
  rationale: string;
  priority: "high" | "medium" | "low";
  bundleType?: "same_category" | "cross_category" | null;
};

export type GenerateProductBundlesOutput = {
  bundles: ProductBundle[];
  summary: string;
  generatedAt: string;
};

const DEFAULT_MAX_BUNDLE_SIZE = 3;
const DEFAULT_MAX_BUNDLES = 10;
const DISCOUNT_TWO_ITEMS = 10;
const DISCOUNT_THREE_OR_MORE = 15;
const DISCOUNT_CROSS_CATEGORY = 8;

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Generates product bundle suggestions from catalog. Deterministic; no external calls.
 */
export function generateProductBundles(input: GenerateProductBundlesInput): GenerateProductBundlesOutput {
  const products = Array.isArray(input.products) ? input.products : [];
  const exclude = new Set((Array.isArray(input.excludeProductIds) ? input.excludeProductIds : []).map((id) => String(id).trim()));
  const maxSize = Math.min(5, Math.max(2, Math.floor(Number(input.maxBundleSize) ?? DEFAULT_MAX_BUNDLE_SIZE)));
  const maxBundles = Math.min(25, Math.max(1, Math.floor(Number(input.maxBundles) ?? DEFAULT_MAX_BUNDLES)));
  const isEn = input.locale === "en";

  const catalog = products
    .filter((p) => p?.productId && !exclude.has(String(p.productId).trim()))
    .map((p) => ({
      productId: String(p.productId).trim(),
      name: safeStr(p.name) || String(p.productId),
      category: safeStr(p.category) || "other",
      price: typeof p.price === "number" && p.price >= 0 ? p.price : 0,
    }));

  const byCategory = new Map<string, typeof catalog>();
  for (const p of catalog) {
    const cat = p.category || "other";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(p);
  }

  const bundles: ProductBundle[] = [];
  const usedPairs = new Set<string>();

  const makeKey = (ids: string[]) => [...ids].sort().join("|");

  for (const [category, items] of byCategory) {
    if (bundles.length >= maxBundles) break;
    if (items.length < 2) continue;

    const size = Math.min(maxSize, items.length);
    for (let n = 2; n <= size && bundles.length < maxBundles; n++) {
      const slice = items.slice(0, n);
      const ids = slice.map((s) => s.productId);
      const key = makeKey(ids);
      if (usedPairs.has(key)) continue;
      usedPairs.add(key);

      const names = slice.map((s) => s.name);
      const totalPrice = slice.reduce((s, x) => s + x.price, 0);
      const discount = n >= 3 ? DISCOUNT_THREE_OR_MORE : DISCOUNT_TWO_ITEMS;
      const suggestedName = isEn
        ? `${category} value pack (${n} items)`
        : `${category} verdipakke (${n} varer)`;

      bundles.push({
        productIds: ids,
        productNames: names,
        suggestedBundleName: suggestedName,
        suggestedPriceDiscountPercent: discount,
        totalPrice: totalPrice > 0 ? Math.round(totalPrice * 100) / 100 : undefined,
        rationale: isEn
          ? `Same category "${category}"; bundle ${n} items with ${discount}% off to encourage multi-buy.`
          : `Samme kategori «${category}»; pakk ${n} varer med ${discount}% rabatt for å oppmuntre til multikjøp.`,
        priority: n >= 3 ? "high" : "medium",
        bundleType: "same_category",
      });
      if (bundles.length >= maxBundles) break;
    }
  }

  const categories = [...byCategory.keys()];
  for (let i = 0; i < categories.length && bundles.length < maxBundles; i++) {
    for (let j = i + 1; j < categories.length && bundles.length < maxBundles; j++) {
      const listA = byCategory.get(categories[i]) ?? [];
      const listB = byCategory.get(categories[j]) ?? [];
      if (listA.length === 0 || listB.length === 0) continue;

      const a = listA[0];
      const b = listB[0];
      const key = makeKey([a.productId, b.productId]);
      if (usedPairs.has(key)) continue;
      usedPairs.add(key);

      const suggestedName = isEn
        ? `${a.name} + ${b.name}`
        : `${a.name} + ${b.name}`;
      const totalPrice = (a.price || 0) + (b.price || 0);

      bundles.push({
        productIds: [a.productId, b.productId],
        productNames: [a.name, b.name],
        suggestedBundleName: suggestedName,
        suggestedPriceDiscountPercent: DISCOUNT_CROSS_CATEGORY,
        totalPrice: totalPrice > 0 ? Math.round(totalPrice * 100) / 100 : undefined,
        rationale: isEn
          ? `Cross-category combo (${categories[i]} + ${categories[j]}); complementary products with ${DISCOUNT_CROSS_CATEGORY}% off.`
          : `Tverrkategori-kombo (${categories[i]} + ${categories[j]}); komplementære produkter med ${DISCOUNT_CROSS_CATEGORY}% rabatt.`,
        priority: "medium",
        bundleType: "cross_category",
      });
    }
  }

  const summary = isEn
    ? `Generated ${bundles.length} bundle suggestion(s). Use suggested discount as a starting point; test conversion.`
    : `Genererte ${bundles.length} pakkeforslag. Bruk foreslått rabatt som utgangspunkt; test konvertering.`;

  return {
    bundles,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { generateProductBundlesCapability, CAPABILITY_NAME };
