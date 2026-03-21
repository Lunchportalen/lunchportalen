/**
 * AI Churn Prediction capability: predictChurnRisk.
 * Oppdager risiko for at en kunde avslutter avtalen.
 * Signaler: færre bestillinger, lavere engagement, flere avbestillinger.
 * Deterministic; no LLM.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "churnPrediction";

const churnPredictionCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Churn prediction: detects risk that a customer will terminate the agreement. Signals: fewer orders, lower engagement, more cancellations. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Churn prediction input (per company/customer)",
    properties: {
      entities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            entityId: { type: "string" },
            entityName: { type: "string" },
            ordersCurrentPeriod: { type: "number" },
            ordersPreviousPeriod: { type: "number" },
            cancellationRate: { type: "number", description: "0-1, cancellations/total" },
            engagementScore: { type: "number", description: "0-1, optional" },
          },
        },
      },
      periodLabel: { type: "string" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["entities"],
  },
  outputSchema: {
    type: "object",
    description: "Churn risk per entity",
    required: ["atRisk", "summary", "generatedAt"],
    properties: {
      atRisk: { type: "array", items: { type: "object" } },
      summary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "prediction_only",
      description: "Output is risk prediction only; no system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(churnPredictionCapability);

export type ChurnEntityInput = {
  entityId: string;
  entityName?: string | null;
  ordersCurrentPeriod: number;
  ordersPreviousPeriod: number;
  cancellationRate?: number | null;
  engagementScore?: number | null;
};

export type ChurnPredictionInput = {
  entities: ChurnEntityInput[];
  periodLabel?: string | null;
  locale?: "nb" | "en" | null;
};

export type ChurnSignal = "fewer_orders" | "lower_engagement" | "more_cancellations";

export type ChurnRiskResult = {
  entityId: string;
  entityName: string | null;
  riskLevel: "high" | "medium" | "low";
  signals: ChurnSignal[];
  signalDescriptions: string[];
  suggestedActions: string[];
  rationale: string;
};

export type ChurnPredictionOutput = {
  atRisk: ChurnRiskResult[];
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

/** Order drop (current vs previous) above this → signal. */
const ORDER_DROP_THRESHOLD = 0.25;
/** Cancellation rate above this → signal. */
const CANCELLATION_RATE_THRESHOLD = 0.15;
/** Engagement below this → signal (if provided). */
const ENGAGEMENT_LOW_THRESHOLD = 0.4;

/**
 * Predicts churn risk from fewer orders, lower engagement, more cancellations. Deterministic.
 */
export function predictChurnRisk(input: ChurnPredictionInput): ChurnPredictionOutput {
  const isEn = input.locale === "en";
  const entities = Array.isArray(input.entities) ? input.entities : [];
  const periodLabel = safeStr(input.periodLabel) || (isEn ? "the period" : "perioden");

  const atRisk: ChurnRiskResult[] = [];

  for (const e of entities) {
    const entityId = safeStr(e.entityId);
    if (!entityId) continue;

    const entityName = safeStr(e.entityName) || null;
    const ordersCurrent = Math.max(0, safeNum(e.ordersCurrentPeriod));
    const ordersPrevious = Math.max(0, safeNum(e.ordersPreviousPeriod));
    const cancellationRate = Math.min(1, Math.max(0, safeNum(e.cancellationRate)));
    const engagementScore = Math.min(1, Math.max(0, safeNum(e.engagementScore)));

    const orderDrop =
      ordersPrevious > 0 ? (ordersPrevious - ordersCurrent) / ordersPrevious : 0;
    const hasOrderDrop = orderDrop >= ORDER_DROP_THRESHOLD;
    const hasHighCancellations = cancellationRate >= CANCELLATION_RATE_THRESHOLD;
    const hasLowEngagement =
      engagementScore > 0 && engagementScore < ENGAGEMENT_LOW_THRESHOLD;

    const signals: ChurnSignal[] = [];
    const signalDescriptions: string[] = [];

    if (hasOrderDrop) {
      signals.push("fewer_orders");
      signalDescriptions.push(
        isEn
          ? `Orders down ${Math.round(orderDrop * 100)}% vs previous period`
          : `Færre bestillinger: ${Math.round(orderDrop * 100)} % ned mot forrige periode`
      );
    }
    if (hasHighCancellations) {
      signals.push("more_cancellations");
      signalDescriptions.push(
        isEn
          ? `High cancellation rate (${Math.round(cancellationRate * 100)}%)`
          : `Flere avbestillinger (${Math.round(cancellationRate * 100)} % avbestillingsandel)`
      );
    }
    if (hasLowEngagement) {
      signals.push("lower_engagement");
      signalDescriptions.push(
        isEn
          ? `Low engagement (score ${Math.round(engagementScore * 100)}%)`
          : `Lavere engagement (score ${Math.round(engagementScore * 100)} %)`
      );
    }

    if (signals.length === 0) continue;

    const riskLevel: "high" | "medium" | "low" =
      signals.length >= 3 || (hasOrderDrop && orderDrop >= 0.4) || cancellationRate >= 0.25
        ? "high"
        : signals.length >= 2 || (hasOrderDrop && orderDrop >= 0.3)
          ? "medium"
          : "low";

    const suggestedActions: string[] = [];
    if (signals.includes("fewer_orders")) {
      suggestedActions.push(
        isEn
          ? "Reach out to understand changing needs; offer menu or frequency options."
          : "Ta kontakt for å forstå endrede behov; tilby meny- eller frekvensalternativer."
      );
    }
    if (signals.includes("more_cancellations")) {
      suggestedActions.push(
        isEn
          ? "Review order deadlines and reminders; consider shorter commitment windows."
          : "Gjennomgå bestillingsfrister og påminnelser; vurder kortere forpliktelsesvinduer."
      );
    }
    if (signals.includes("lower_engagement")) {
      suggestedActions.push(
        isEn
          ? "Increase touchpoints; share new menus or offers to re-engage."
          : "Øk touchpoints; del nye menyer eller tilbud for å re-engasjere."
      );
    }

    const rationale = isEn
      ? `Early churn signals: ${signalDescriptions.join(". ")}. Risk: ${riskLevel}.`
      : `Tidlige tegn på frafall: ${signalDescriptions.join(". ")}. Risiko: ${riskLevel}.`;

    atRisk.push({
      entityId,
      entityName,
      riskLevel,
      signals,
      signalDescriptions,
      suggestedActions,
      rationale,
    });
  }

  const highCount = atRisk.filter((r) => r.riskLevel === "high").length;
  const summary = isEn
    ? `${atRisk.length} customer(s) with churn signals for ${periodLabel}; ${highCount} high risk. Use for proactive retention.`
    : `${atRisk.length} kunde(r) med frafallssignaler for ${periodLabel}; ${highCount} høy risiko. Bruk til proaktiv binding.`;

  return {
    atRisk,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
