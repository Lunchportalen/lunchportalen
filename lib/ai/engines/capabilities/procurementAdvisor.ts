/**
 * AI Procurement Planner / Procurement Advisor capability: suggestProcurement.
 * AI foreslår innkjøp basert på: prognoser, menyplan, leveringsvolum.
 * Deterministic; no LLM.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "procurementAdvisor";

const procurementAdvisorCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Procurement planner: suggests procurement based on forecasts, menu plan, and delivery volume. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Procurement input (from prognoser, menyplan, leveringsvolum)",
    properties: {
      forecastItems: {
        type: "array",
        description: "Items with forecasted demand (from prognoser/menyplan/leveringsvolum) and delivery date",
        items: {
          type: "object",
          properties: {
            itemId: { type: "string" },
            name: { type: "string" },
            forecastQuantity: { type: "number" },
            unit: { type: "string" },
            deliveryBy: { type: "string", description: "ISO date when delivery is needed" },
            leadTimeDays: { type: "number" },
          },
        },
      },
      rawMaterialPrices: {
        type: "array",
        items: {
          type: "object",
          properties: {
            itemId: { type: "string" },
            unitPrice: { type: "number" },
            currency: { type: "string" },
          },
        },
      },
      safetyMarginFactor: { type: "number", description: "e.g. 1.1 = 10% extra" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["forecastItems"],
  },
  outputSchema: {
    type: "object",
    description: "Procurement suggestions",
    required: ["suggestions", "summary", "generatedAt"],
    properties: {
      suggestions: { type: "array", items: { type: "object" } },
      summary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "suggestion_only",
      description: "Output is procurement suggestions only; no system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api", "kitchen"],
};

registerCapability(procurementAdvisorCapability);

export type ForecastItemInput = {
  itemId: string;
  name?: string | null;
  forecastQuantity: number;
  unit?: string | null;
  deliveryBy: string;
  leadTimeDays?: number | null;
};

export type RawMaterialPriceInput = {
  itemId: string;
  unitPrice: number;
  currency?: string | null;
};

export type ProcurementAdvisorInput = {
  forecastItems: ForecastItemInput[];
  rawMaterialPrices?: RawMaterialPriceInput[] | null;
  safetyMarginFactor?: number | null;
  locale?: "nb" | "en" | null;
};

export type ProcurementSuggestion = {
  itemId: string;
  name: string;
  suggestedQuantity: number;
  unit: string;
  orderBy: string;
  deliveryBy: string;
  estimatedCost: number | null;
  currency: string | null;
  rationale: string;
};

export type ProcurementAdvisorOutput = {
  suggestions: ProcurementSuggestion[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate.slice(0, 10));
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Suggests procurement: quantity from forecast + safety margin, order-by date from delivery plan, cost from price. Deterministic.
 */
export function suggestProcurement(input: ProcurementAdvisorInput): ProcurementAdvisorOutput {
  const isEn = input.locale === "en";
  const items = Array.isArray(input.forecastItems) ? input.forecastItems : [];
  const prices = Array.isArray(input.rawMaterialPrices) ? input.rawMaterialPrices : [];
  const priceByItem = new Map<string, { unitPrice: number; currency: string }>();
  for (const p of prices) {
    const id = safeStr(p.itemId);
    if (id) priceByItem.set(id, { unitPrice: safeNum(p.unitPrice), currency: safeStr(p.currency) || "NOK" });
  }
  const safetyMargin = safeNum(input.safetyMarginFactor);
  const factor = safetyMargin >= 1 && safetyMargin <= 1.5 ? safetyMargin : 1.1;

  const suggestions: ProcurementSuggestion[] = [];

  for (const item of items) {
    const itemId = safeStr(item.itemId);
    if (!itemId) continue;

    const name = safeStr(item.name) || itemId;
    const forecastQty = Math.max(0, safeNum(item.forecastQuantity));
    const unit = safeStr(item.unit) || (isEn ? "pcs" : "stk");
    const deliveryBy = safeStr(item.deliveryBy).slice(0, 10);
    const leadTimeDays = Math.max(0, Math.min(90, safeNum(item.leadTimeDays)));

    const suggestedQuantity = Math.ceil(forecastQty * factor);
    const orderBy = deliveryBy ? addDays(deliveryBy, leadTimeDays) : "";

    const priceInfo = priceByItem.get(itemId);
    const estimatedCost = priceInfo ? Math.round(suggestedQuantity * priceInfo.unitPrice * 100) / 100 : null;
    const currency = priceInfo?.currency ?? null;

    const rationaleParts: string[] = [];
    rationaleParts.push(
      isEn
        ? `Based on forecast (${forecastQty} ${unit})${factor > 1 ? ` + ${Math.round((factor - 1) * 100)}% safety margin` : ""}.`
        : `Basert på prognose (${forecastQty} ${unit})${factor > 1 ? ` + ${Math.round((factor - 1) * 100)} % sikkerhetsmargin` : ""}.`
    );
    rationaleParts.push(
      isEn
        ? `Order by ${orderBy} for delivery by ${deliveryBy} (lead time ${leadTimeDays} days).`
        : `Bestill innen ${orderBy} for levering innen ${deliveryBy} (leveranstid ${leadTimeDays} dager).`
    );
    if (estimatedCost != null && currency) {
      rationaleParts.push(
        isEn
          ? `Estimated cost ${estimatedCost} ${currency} at current price.`
          : `Estimert kostnad ${estimatedCost} ${currency} til nåværende pris.`
      );
    } else {
      rationaleParts.push(
        isEn ? "Add raw material price for cost estimate." : "Legg inn råvarepris for kostnadsestimat."
      );
    }

    suggestions.push({
      itemId,
      name,
      suggestedQuantity,
      unit,
      orderBy,
      deliveryBy,
      estimatedCost,
      currency,
      rationale: rationaleParts.join(" "),
    });
  }

  const totalCost = suggestions.reduce((s, x) => s + (x.estimatedCost ?? 0), 0);
  const currencyUsed = suggestions[0]?.currency ?? "NOK";
  const summary = isEn
    ? `${suggestions.length} procurement suggestion(s); total estimated ${totalCost.toFixed(2)} ${currencyUsed} (forecasts, menu plan, delivery volume).`
    : `${suggestions.length} innkjøpsforslag; totalt estimert ${totalCost.toFixed(2)} ${currencyUsed} (prognoser, menyplan, leveringsvolum).`;

  return {
    suggestions,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
