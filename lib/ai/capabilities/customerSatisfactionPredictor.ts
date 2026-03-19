/**
 * AI Customer Satisfaction Predictor capability: predictCustomerSatisfaction.
 * AI estimerer hvor fornøyde kunder er basert på: bestillingsmønstre, retter, endringer.
 * Deterministic; no LLM.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "customerSatisfactionPredictor";

const customerSatisfactionPredictorCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Customer satisfaction predictor: estimates how satisfied customers are based on ordering patterns, dishes, and changes. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Customer satisfaction predictor input (per company or segment)",
    properties: {
      entityId: { type: "string" },
      entityName: { type: "string" },
      orderingPattern: {
        type: "object",
        description: "Bestillingsmønstre",
        properties: {
          ordersCurrentPeriod: { type: "number" },
          ordersPreviousPeriod: { type: "number" },
          ordersPerWeekLastFourWeeks: { type: "array", items: { type: "number" } },
          consistentOrderingDays: { type: "number", description: "Approx. same days per week" },
        },
      },
      dishMetrics: {
        type: "object",
        description: "Retter: variasjon og populære valg",
        properties: {
          uniqueDishesOrdered: { type: "number" },
          topDishSharePercent: { type: "number", description: "Share of orders for single top dish" },
          repeatFavoriteShare: { type: "number", description: "Share of orders that are repeat favorites, 0-1" },
        },
      },
      changes: {
        type: "object",
        description: "Endringer som påvirker tilfredshet",
        properties: {
          cancellationRate: { type: "number", description: "0-1" },
          orderCountChangePercent: { type: "number", description: "e.g. -20 = 20% fewer orders" },
          menuChangeComplaintsHint: { type: "number", description: "Optional: 0 = none, 1+ = signals" },
        },
      },
      periodLabel: { type: "string" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["entityId", "orderingPattern", "dishMetrics", "changes"],
  },
  outputSchema: {
    type: "object",
    description: "Satisfaction estimate",
    required: ["satisfactionLevel", "satisfactionScore", "factors", "summary", "generatedAt"],
    properties: {
      satisfactionLevel: { type: "string", enum: ["high", "medium", "low"] },
      satisfactionScore: { type: "number" },
      factors: { type: "array", items: { type: "object" } },
      summary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "estimate_only",
      description: "Output is satisfaction estimate only; no system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(customerSatisfactionPredictorCapability);

export type OrderingPatternInput = {
  ordersCurrentPeriod: number;
  ordersPreviousPeriod?: number | null;
  ordersPerWeekLastFourWeeks?: number[] | null;
  consistentOrderingDays?: number | null;
};

export type DishMetricsInput = {
  uniqueDishesOrdered: number;
  topDishSharePercent?: number | null;
  repeatFavoriteShare?: number | null;
};

export type ChangesInput = {
  cancellationRate?: number | null;
  orderCountChangePercent?: number | null;
  menuChangeComplaintsHint?: number | null;
};

export type CustomerSatisfactionPredictorInput = {
  entityId: string;
  entityName?: string | null;
  orderingPattern: OrderingPatternInput;
  dishMetrics: DishMetricsInput;
  changes: ChangesInput;
  periodLabel?: string | null;
  locale?: "nb" | "en" | null;
};

export type SatisfactionFactor = {
  factor: string;
  impact: "positive" | "negative" | "neutral";
  description: string;
};

export type CustomerSatisfactionPredictorOutput = {
  satisfactionLevel: "high" | "medium" | "low";
  satisfactionScore: number;
  factors: SatisfactionFactor[];
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

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Estimates customer satisfaction from ordering patterns, dishes, and changes. Deterministic.
 */
export function predictCustomerSatisfaction(
  input: CustomerSatisfactionPredictorInput
): CustomerSatisfactionPredictorOutput {
  const isEn = input.locale === "en";
  const entityName = safeStr(input.entityName) || safeStr(input.entityId);
  const pattern = input.orderingPattern;
  const dishes = input.dishMetrics;
  const changes = input.changes;

  const ordersCurrent = Math.max(0, safeNum(pattern.ordersCurrentPeriod));
  const ordersPrevious = Math.max(0, safeNum(pattern.ordersPreviousPeriod));
  const weeks = Array.isArray(pattern.ordersPerWeekLastFourWeeks)
    ? pattern.ordersPerWeekLastFourWeeks.map((w) => Math.max(0, safeNum(w)))
    : [];
  const consistentDays = Math.max(0, Math.min(7, safeNum(pattern.consistentOrderingDays)));

  const uniqueDishes = Math.max(0, safeNum(dishes.uniqueDishesOrdered));
  const topDishShare = clamp01(safeNum(dishes.topDishSharePercent) / 100);
  const repeatFavorite = clamp01(safeNum(dishes.repeatFavoriteShare));

  const cancellationRate = clamp01(safeNum(changes.cancellationRate));
  const orderChangePercent = safeNum(changes.orderCountChangePercent);
  const complaintsHint = Math.max(0, safeNum(changes.menuChangeComplaintsHint));

  const factors: SatisfactionFactor[] = [];
  let score = 0.5;

  if (ordersPrevious > 0) {
    const growth = (ordersCurrent - ordersPrevious) / ordersPrevious;
    if (growth >= 0.1) {
      score += 0.15;
      factors.push({
        factor: isEn ? "Order growth" : "Bestillingsvekst",
        impact: "positive",
        description: isEn
          ? `Orders increased by ${Math.round(growth * 100)}% vs previous period.`
          : `Bestillinger økte med ${Math.round(growth * 100)} % mot forrige periode.`,
      });
    } else if (growth <= -0.15) {
      score -= 0.2;
      factors.push({
        factor: isEn ? "Declining orders" : "Synkende bestillinger",
        impact: "negative",
        description: isEn
          ? `Orders down ${Math.round(-growth * 100)}% vs previous period; may indicate lower satisfaction.`
          : `Bestillinger ned ${Math.round(-growth * 100)} % mot forrige periode; kan tyde på lavere tilfredshet.`,
      });
    }
  }

  if (cancellationRate > 0.15) {
    score -= 0.15;
    factors.push({
      factor: isEn ? "High cancellations" : "Høye avbestillinger",
      impact: "negative",
      description: isEn
        ? `Cancellation rate ${Math.round(cancellationRate * 100)}% suggests friction or unmet expectations.`
        : `Avbestillingsandel ${Math.round(cancellationRate * 100)} % tyder på friksjon eller uoppfylte forventninger.`,
    });
  } else if (cancellationRate < 0.05 && ordersCurrent > 0) {
    score += 0.05;
    factors.push({
      factor: isEn ? "Low cancellations" : "Lave avbestillinger",
      impact: "positive",
      description: isEn
        ? "Low cancellation rate supports stable satisfaction."
        : "Lav avbestillingsandel støtter stabil tilfredshet.",
    });
  }

  if (uniqueDishes >= 5) {
    score += 0.08;
    factors.push({
      factor: isEn ? "Menu variety" : "Menyvariasjon",
      impact: "positive",
      description: isEn
        ? `Good variety (${uniqueDishes} different dishes) suggests engaged customers.`
        : `God variasjon (${uniqueDishes} ulike retter) tyder på engasjerte kunder.`,
    });
  } else if (uniqueDishes <= 1 && ordersCurrent > 2) {
    score -= 0.05;
    factors.push({
      factor: isEn ? "Low variety" : "Lav variasjon",
      impact: "negative",
      description: isEn
        ? "Very few dish choices may indicate limited appeal or habit only."
        : "Svært få rettvalg kan tyde på begrenset appell eller bare vaner.",
    });
  }

  if (repeatFavorite >= 0.5 && repeatFavorite <= 0.9) {
    score += 0.05;
    factors.push({
      factor: isEn ? "Repeat favorites" : "Gjentatte favoritter",
      impact: "positive",
      description: isEn
        ? "Healthy share of repeat favorites suggests satisfied, loyal behavior."
        : "Fornuftig andel gjentatte favoritter tyder på fornøyde, lojale kunder.",
    });
  }

  if (orderChangePercent <= -20) {
    factors.push({
      factor: isEn ? "Sharp order decline" : "Markant bestillingsnedgang",
      impact: "negative",
      description: isEn
        ? `${Math.round(-orderChangePercent)}% fewer orders; strong signal to check satisfaction.`
        : `${Math.round(-orderChangePercent)} % færre bestillinger; tydelig signal om å sjekke tilfredshet.`,
    });
  }

  if (complaintsHint > 0) {
    score -= 0.1;
    factors.push({
      factor: isEn ? "Menu change feedback" : "Tilbakemelding på menyendringer",
      impact: "negative",
      description: isEn
        ? "Signals of dissatisfaction with menu changes."
        : "Signaler på misnøye med menyendringer.",
    });
  }

  if (consistentDays >= 4 && ordersCurrent >= 5) {
    score += 0.05;
    factors.push({
      factor: isEn ? "Consistent ordering" : "Konsistent bestilling",
      impact: "positive",
      description: isEn
        ? "Regular ordering pattern suggests habit and reliance on the service."
        : "Jevn bestillingsmønster tyder på vane og tillit til tjenesten.",
    });
  }

  const satisfactionScore = clamp01(score);
  let satisfactionLevel: "high" | "medium" | "low";
  if (satisfactionScore >= 0.65) satisfactionLevel = "high";
  else if (satisfactionScore >= 0.4) satisfactionLevel = "medium";
  else satisfactionLevel = "low";

  if (factors.length === 0) {
    factors.push({
      factor: isEn ? "Neutral signals" : "Nøytrale signaler",
      impact: "neutral",
      description: isEn
        ? "Insufficient signals to infer strong satisfaction or dissatisfaction."
        : "Utilstrekkelige signaler for å konkludere med høy eller lav tilfredshet.",
    });
  }

  const levelLabel = isEn
    ? { high: "High", medium: "Medium", low: "Low" }
    : { high: "Høy", medium: "Middels", low: "Lav" };
  const summary = isEn
    ? `Estimated satisfaction for ${entityName}: ${levelLabel[satisfactionLevel]} (score ${(satisfactionScore * 100).toFixed(0)}/100). Based on ordering patterns, dishes, and changes.`
    : `Estimert tilfredshet for ${entityName}: ${levelLabel[satisfactionLevel]} (score ${(satisfactionScore * 100).toFixed(0)}/100). Basert på bestillingsmønstre, retter og endringer.`;

  return {
    satisfactionLevel,
    satisfactionScore,
    factors,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
