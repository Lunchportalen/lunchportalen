/**
 * Pricing optimization AI capability: suggestPricingAdjustments.
 * Suggests price adjustments from current price, cost, demand, conversion, and optional
 * competitor price. Returns direction (increase | decrease | hold), suggested price/change %,
 * rationale, and priority. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "suggestPricingAdjustments";

const suggestPricingAdjustmentsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Pricing optimization AI: suggests price adjustments from current price, cost, demand level, conversion rate, and optional competitor price. Returns direction (increase | decrease | hold), suggested price or change percent, rationale, and priority. Use minMarginPercent/maxPriceChangePercent to constrain. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Suggest pricing adjustments input",
    properties: {
      products: {
        type: "array",
        description: "Products: productId, name?, currentPrice, cost?, demandLevel?, conversionRate?, competitorPrice?",
        items: {
          type: "object",
          required: ["productId", "currentPrice"],
          properties: {
            productId: { type: "string" },
            name: { type: "string" },
            currentPrice: { type: "number", description: "Current price (numeric)" },
            cost: { type: "number", description: "Unit cost for margin calculation" },
            demandLevel: { type: "string", enum: ["high", "medium", "low"] },
            conversionRate: { type: "number", description: "0-1" },
            competitorPrice: { type: "number", description: "Competitor or market reference price" },
          },
        },
      },
      minMarginPercent: {
        type: "number",
        description: "Minimum acceptable margin % (e.g. 20); suggestions respect this when cost is provided",
      },
      maxPriceChangePercent: {
        type: "number",
        description: "Max allowed change % (e.g. 15); suggested change is capped",
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["products"],
  },
  outputSchema: {
    type: "object",
    description: "Pricing adjustment suggestions",
    required: ["adjustments", "summary", "suggestedAt"],
    properties: {
      adjustments: {
        type: "array",
        items: {
          type: "object",
          required: ["productId", "productName", "direction", "rationale", "priority"],
          properties: {
            productId: { type: "string" },
            productName: { type: "string" },
            direction: { type: "string", enum: ["increase", "decrease", "hold"] },
            currentPrice: { type: "number" },
            suggestedPrice: { type: "number" },
            changePercent: { type: "number" },
            rationale: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
          },
        },
      },
      summary: { type: "string" },
      suggestedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is suggestions only; no pricing or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(suggestPricingAdjustmentsCapability);

export type PricingProductInput = {
  productId: string;
  name?: string | null;
  currentPrice: number;
  cost?: number | null;
  demandLevel?: "high" | "medium" | "low" | null;
  conversionRate?: number | null;
  competitorPrice?: number | null;
};

export type SuggestPricingAdjustmentsInput = {
  products: PricingProductInput[];
  minMarginPercent?: number | null;
  maxPriceChangePercent?: number | null;
  locale?: "nb" | "en" | null;
};

export type PricingAdjustment = {
  productId: string;
  productName: string;
  direction: "increase" | "decrease" | "hold";
  currentPrice: number;
  suggestedPrice?: number | null;
  changePercent?: number | null;
  rationale: string;
  priority: "high" | "medium" | "low";
};

export type SuggestPricingAdjustmentsOutput = {
  adjustments: PricingAdjustment[];
  summary: string;
  suggestedAt: string;
};

const DEFAULT_MAX_CHANGE_PERCENT = 15;
const DEFAULT_MIN_MARGIN_PERCENT = 20;
const SUGGESTED_INCREASE_PERCENT = 5;
const SUGGESTED_DECREASE_PERCENT = 5;

function roundPrice(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Suggests pricing adjustments from product data. Deterministic; no external calls.
 */
export function suggestPricingAdjustments(input: SuggestPricingAdjustmentsInput): SuggestPricingAdjustmentsOutput {
  const products = Array.isArray(input.products) ? input.products : [];
  const maxChange = Math.min(50, Math.max(0, Number(input.maxPriceChangePercent) ?? DEFAULT_MAX_CHANGE_PERCENT)) / 100;
  const minMargin = Number(input.minMarginPercent) ?? DEFAULT_MIN_MARGIN_PERCENT;
  const isEn = input.locale === "en";

  const adjustments: PricingAdjustment[] = [];

  for (const p of products) {
    const productId = String(p?.productId ?? "").trim();
    if (!productId) continue;

    const name = String(p?.name ?? "").trim() || productId;
    const currentPrice = Math.max(0, Number(p?.currentPrice) ?? 0);
    const cost = typeof p?.cost === "number" && p.cost >= 0 ? p.cost : null;
    const demandLevel = p?.demandLevel === "high" || p?.demandLevel === "medium" || p?.demandLevel === "low" ? p.demandLevel : null;
    const conversionRate = typeof p?.conversionRate === "number" ? Math.max(0, Math.min(1, p.conversionRate)) : null;
    const competitorPrice = typeof p?.competitorPrice === "number" && p.competitorPrice >= 0 ? p.competitorPrice : null;

    const marginPercent = cost != null && currentPrice > 0 ? ((currentPrice - cost) / currentPrice) * 100 : null;

    let direction: "increase" | "decrease" | "hold" = "hold";
    let suggestedPrice: number | undefined;
    let changePercent: number | undefined;
    let rationale: string;
    let priority: "high" | "medium" | "low" = "medium";

    if (currentPrice <= 0) {
      rationale = isEn ? "Invalid or zero price; set a valid price before optimization." : "Ugyldig eller null pris; sett en gyldig pris før optimalisering.";
      adjustments.push({
        productId,
        productName: name,
        direction: "hold",
        currentPrice: 0,
        rationale,
        priority: "low",
      });
      continue;
    }

    if (demandLevel === "high" && (conversionRate == null || conversionRate >= 0.05)) {
      const increasePct = Math.min(maxChange, SUGGESTED_INCREASE_PERCENT / 100);
      if (marginPercent == null || marginPercent >= minMargin) {
        direction = "increase";
        changePercent = increasePct;
        suggestedPrice = roundPrice(currentPrice * (1 + increasePct));
        rationale = isEn
          ? "High demand and solid conversion; small price increase can capture value. Test and monitor conversion."
          : "Høy etterspørsel og god konvertering; liten prisøkning kan fange verdi. Test og overvåk konvertering.";
        priority = "high";
      } else {
        direction = "hold";
        rationale = isEn
          ? "High demand but margin below target; consider increase up to margin target if conversion allows."
          : "Høy etterspørsel men margin under mål; vurder økning opp til marginmål hvis konvertering tillater det.";
      }
    } else if (demandLevel === "high" && conversionRate != null && conversionRate < 0.05) {
      direction = "hold";
      rationale = isEn
        ? "High interest but low conversion; fix offer or friction before raising price."
        : "Høy interesse men lav konvertering; fiks tilbud eller friksjon før prisøkning.";
    } else if (marginPercent != null && marginPercent < minMargin && cost != null) {
      const targetPrice = cost / (1 - minMargin / 100);
      if (targetPrice > currentPrice) {
        const pct = (targetPrice - currentPrice) / currentPrice;
        if (pct <= maxChange) {
          direction = "increase";
          suggestedPrice = roundPrice(targetPrice);
          changePercent = pct;
          rationale = isEn
            ? `Margin (${Math.round(marginPercent)}%) below target (${minMargin}%); suggest increase to meet minimum margin.`
            : `Margin (${Math.round(marginPercent)}%) under mål (${minMargin}%); foreslå økning for å nå minimum margin.`;
          priority = "high";
        } else {
          direction = "hold";
          rationale = isEn
            ? "Margin below target; required increase exceeds max change. Review cost or positioning."
            : "Margin under mål; nødvendig økning overstiger max endring. Vurder kostnad eller posisjonering.";
        }
      } else {
        direction = "hold";
        rationale = isEn ? "Margin within or above target; no change suggested." : "Margin innenfor eller over mål; ingen endring foreslått.";
      }
    } else if (competitorPrice != null && currentPrice > competitorPrice * 1.1) {
      direction = "decrease";
      const pct = Math.min(maxChange, SUGGESTED_DECREASE_PERCENT / 100);
      suggestedPrice = roundPrice(currentPrice * (1 - pct));
      changePercent = -pct;
      rationale = isEn
        ? "Price above competitor; consider small decrease or strengthen value messaging."
        : "Pris over konkurrent; vurder liten nedgang eller styrk verdibudskap.";
      priority = "medium";
    } else if (demandLevel === "low") {
      direction = "hold";
      rationale = isEn
        ? "Low demand; avoid price increase. Focus on visibility or value before testing price changes."
        : "Lav etterspørsel; unngå prisøkning. Fokuser på synlighet eller verdi før pristester.";
    } else {
      direction = "hold";
      rationale = isEn ? "No strong signal for change; hold price and monitor demand and conversion." : "Ingen sterkt signal for endring; behold pris og overvåk etterspørsel og konvertering.";
    }

    adjustments.push({
      productId,
      productName: name,
      direction,
      currentPrice,
      suggestedPrice: suggestedPrice ?? undefined,
      changePercent: changePercent != null ? roundPrice(changePercent * 100) : undefined,
      rationale,
      priority,
    });
  }

  adjustments.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });

  const increaseCount = adjustments.filter((a) => a.direction === "increase").length;
  const decreaseCount = adjustments.filter((a) => a.direction === "decrease").length;
  const summary = isEn
    ? `Suggested adjustments for ${adjustments.length} product(s): ${increaseCount} increase, ${decreaseCount} decrease, ${adjustments.length - increaseCount - decreaseCount} hold.`
    : `Foreslåtte justeringer for ${adjustments.length} produkt(er): ${increaseCount} økning, ${decreaseCount} nedgang, ${adjustments.length - increaseCount - decreaseCount} behold.`;

  return {
    adjustments,
    summary,
    suggestedAt: new Date().toISOString(),
  };
}

export { suggestPricingAdjustmentsCapability, CAPABILITY_NAME };
