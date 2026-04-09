/**
 * Product demand analyzer capability: detectProductDemand.
 * Analyzes product-level metrics (views, clicks, add-to-cart, purchases, search volume)
 * to assess demand level, trend, and opportunity. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "detectProductDemand";

const detectProductDemandCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Product demand analyzer: from per-product metrics (views, clicks, addToCart, purchases, searchVolume), assesses demand level (high/medium/low), optional trend, and recommendation. Flags high-demand products and opportunity products (interest but low conversion). Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Detect product demand input",
    properties: {
      products: {
        type: "array",
        description: "Products with metrics: productId, name?, views?, clicks?, addToCartCount?, purchaseCount?, searchVolume?",
        items: {
          type: "object",
          required: ["productId"],
          properties: {
            productId: { type: "string" },
            name: { type: "string" },
            views: { type: "number" },
            clicks: { type: "number" },
            addToCartCount: { type: "number" },
            purchaseCount: { type: "number" },
            searchVolume: { type: "number", description: "Optional search or query volume" },
          },
        },
      },
      thresholds: {
        type: "object",
        description: "Optional custom thresholds for high/medium demand",
        properties: {
          highViews: { type: "number" },
          highPurchases: { type: "number" },
          highSearchVolume: { type: "number" },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["products"],
  },
  outputSchema: {
    type: "object",
    description: "Product demand analysis result",
    required: ["demandSignals", "summary", "detectedAt"],
    properties: {
      demandSignals: {
        type: "array",
        items: {
          type: "object",
          required: ["productId", "productName", "demandLevel", "recommendation", "priority"],
          properties: {
            productId: { type: "string" },
            productName: { type: "string" },
            demandLevel: { type: "string", enum: ["high", "medium", "low"] },
            trend: { type: "string", enum: ["rising", "stable", "declining"], description: "Optional when trend data available" },
            recommendation: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            opportunityType: { type: "string", description: "e.g. high_interest_low_convert when applicable" },
          },
        },
      },
      summary: { type: "string" },
      detectedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is analysis only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(detectProductDemandCapability);

export type ProductMetricsInput = {
  productId: string;
  name?: string | null;
  views?: number | null;
  clicks?: number | null;
  addToCartCount?: number | null;
  purchaseCount?: number | null;
  searchVolume?: number | null;
};

export type DetectProductDemandInput = {
  products: ProductMetricsInput[];
  thresholds?: {
    highViews?: number | null;
    highPurchases?: number | null;
    highSearchVolume?: number | null;
  } | null;
  locale?: "nb" | "en" | null;
};

export type ProductDemandSignal = {
  productId: string;
  productName: string;
  demandLevel: "high" | "medium" | "low";
  trend?: "rising" | "stable" | "declining" | null;
  recommendation: string;
  priority: "high" | "medium" | "low";
  opportunityType?: string | null;
};

export type DetectProductDemandOutput = {
  demandSignals: ProductDemandSignal[];
  summary: string;
  detectedAt: string;
};

const DEFAULT_HIGH_VIEWS = 500;
const DEFAULT_HIGH_PURCHASES = 20;
const DEFAULT_HIGH_SEARCH_VOLUME = 100;

/**
 * Analyzes product demand from per-product metrics. Deterministic; no external calls.
 */
export function detectProductDemand(input: DetectProductDemandInput): DetectProductDemandOutput {
  const products = Array.isArray(input.products) ? input.products : [];
  const th = input.thresholds ?? {};
  const highViews = Math.max(1, Number(th.highViews) || DEFAULT_HIGH_VIEWS);
  const highPurchases = Math.max(1, Number(th.highPurchases) || DEFAULT_HIGH_PURCHASES);
  const highSearch = Math.max(1, Number(th.highSearchVolume) || DEFAULT_HIGH_SEARCH_VOLUME);
  const isEn = input.locale === "en";

  const demandSignals: ProductDemandSignal[] = [];

  for (const p of products) {
    const productId = String(p?.productId ?? "").trim();
    if (!productId) continue;

    const name = String(p?.name ?? "").trim() || productId;
    const views = Math.max(0, Number(p?.views) ?? 0);
    const clicks = Math.max(0, Number(p?.clicks) ?? 0);
    const addToCart = Math.max(0, Number(p?.addToCartCount) ?? 0);
    const purchases = Math.max(0, Number(p?.purchaseCount) ?? 0);
    const searchVol = Math.max(0, Number(p?.searchVolume) ?? 0);

    const hasInterest = views >= highViews * 0.2 || searchVol >= highSearch * 0.2 || clicks >= 10;
    const hasConversion = purchases >= highPurchases * 0.2 || addToCart >= 5;
    const highInterest = views >= highViews || searchVol >= highSearch;
    const highConversion = purchases >= highPurchases || addToCart >= highPurchases;

    let demandLevel: "high" | "medium" | "low" = "low";
    let recommendation: string;
    let priority: "high" | "medium" | "low" = "low";
    let opportunityType: string | undefined;

    if (highInterest && highConversion) {
      demandLevel = "high";
      priority = "high";
      recommendation = isEn
        ? `Strong demand: high views and conversions. Maintain availability and visibility; consider featured placement or bundling.`
        : `Sterk etterspørsel: høye visninger og konverteringer. Oppretthold tilgjengelighet og synlighet; vurder fremhevet plassering eller pakking.`;
    } else if (highInterest && !hasConversion) {
      demandLevel = "medium";
      priority = "high";
      opportunityType = "high_interest_low_convert";
      recommendation = isEn
        ? `Demand signal present but low conversion. Improve offer: price, clarity, CTA, or checkout friction.`
        : `Etterspørselsignal til stede men lav konvertering. Forbedre tilbud: pris, tydelighet, CTA eller kassefriksjon.`;
    } else if (hasInterest && hasConversion) {
      demandLevel = "medium";
      priority = "medium";
      recommendation = isEn
        ? `Moderate demand. Monitor stock and consider light promotion to scale.`
        : `Moderat etterspørsel. Overvåk lager og vurder lett promotering for å skalerer.`;
    } else if (hasInterest) {
      demandLevel = "medium";
      priority = "medium";
      recommendation = isEn
        ? `Some interest; conversion opportunity. Clarify value prop and reduce friction to purchase.`
        : `Noe interesse; konverteringsmulighet. Tydeliggjør verdiforslag og reduser friksjon til kjøp.`;
    } else if (searchVol >= highSearch * 0.5) {
      demandLevel = "medium";
      priority = "medium";
      recommendation = isEn
        ? `Search volume indicates interest; improve product visibility and landing experience.`
        : `Søkevolum indikerer interesse; forbedre produktsynlighet og landingserfaring.`;
    } else {
      demandLevel = "low";
      recommendation = isEn
        ? `Low demand signals. Increase visibility (SEO, placement, campaigns) or review product-market fit.`
        : `Lave etterspørselssignaler. Øk synlighet (SEO, plassering, kampanjer) eller vurder produkt-markedsmatch.`;
    }

    demandSignals.push({
      productId,
      productName: name,
      demandLevel,
      recommendation,
      priority,
      opportunityType: opportunityType ?? undefined,
    });
  }

  demandSignals.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });

  const highCount = demandSignals.filter((s) => s.demandLevel === "high").length;
  const opportunityCount = demandSignals.filter((s) => s.opportunityType === "high_interest_low_convert").length;
  const summary = isEn
    ? `Analyzed ${demandSignals.length} product(s). ${highCount} high-demand, ${opportunityCount} opportunity (interest but low conversion).`
    : `Analysert ${demandSignals.length} produkt(er). ${highCount} høy etterspørsel, ${opportunityCount} mulighet (interesse men lav konvertering).`;

  return {
    demandSignals,
    summary,
    detectedAt: new Date().toISOString(),
  };
}

export { detectProductDemandCapability, CAPABILITY_NAME };
