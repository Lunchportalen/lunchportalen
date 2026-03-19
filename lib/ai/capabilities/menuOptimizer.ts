/**
 * AI Menu Optimizer capability: analyzeDishPerformance.
 * AI analyserer hvilke retter som fungerer.
 * Output: hvilke retter bør beholdes, hvilke bør byttes, hvilke gir høy tilfredshet.
 * Deterministic; no LLM.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "menuOptimizer";

const menuOptimizerCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Menu optimizer: analyzes which dishes work. Output: which to keep, which to swap, which have high satisfaction. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Menu optimizer input — per-dish performance",
    properties: {
      dishes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            dishId: { type: "string" },
            title: { type: "string" },
            orderCount: { type: "number" },
            satisfactionScore: { type: "number", description: "0-1 or 1-5 scale" },
            satisfactionScale: { type: "string", enum: ["0-1", "1-5"] },
            cancellationRate: { type: "number", description: "0-1" },
          },
        },
      },
      periodLabel: { type: "string" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["dishes"],
  },
  outputSchema: {
    type: "object",
    description: "Menu optimizer output",
    required: ["dishesToKeep", "dishesToSwap", "highSatisfactionDishes", "summary", "generatedAt"],
    properties: {
      dishesToKeep: { type: "array", items: { type: "object" } },
      dishesToSwap: { type: "array", items: { type: "object" } },
      highSatisfactionDishes: { type: "array", items: { type: "object" } },
      summary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "suggestions_only",
      description: "Output is analysis and suggestions only; no system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api", "kitchen"],
};

registerCapability(menuOptimizerCapability);

export type DishPerformanceInput = {
  dishId?: string | null;
  title?: string | null;
  orderCount: number;
  satisfactionScore?: number | null;
  satisfactionScale?: "0-1" | "1-5" | null;
  cancellationRate?: number | null;
};

export type MenuOptimizerInput = {
  dishes: DishPerformanceInput[];
  periodLabel?: string | null;
  locale?: "nb" | "en" | null;
};

export type DishRecommendation = {
  dishId: string | null;
  title: string;
  rationale: string;
  orderCount: number;
  satisfactionHint?: string | null;
};

export type MenuOptimizerOutput = {
  dishesToKeep: DishRecommendation[];
  dishesToSwap: DishRecommendation[];
  highSatisfactionDishes: DishRecommendation[];
  summary: string;
  generatedAt: string;
};

const SATISFACTION_HIGH_01 = 0.75;
const SATISFACTION_HIGH_15 = 4;
const SATISFACTION_LOW_01 = 0.5;
const SATISFACTION_LOW_15 = 2.5;
const CANCEL_SWAP_THRESHOLD = 0.2;
const MIN_ORDERS_KEEP = 3;
const MIN_ORDERS_HIGH_SAT = 5;

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Normalize satisfaction to 0-1. */
function toScore01(score: number, scale: "0-1" | "1-5"): number {
  if (scale === "0-1") return Math.min(1, Math.max(0, score));
  return Math.min(1, Math.max(0, (score - 1) / 4));
}

/**
 * Analyserer hvilke retter som fungerer; returnerer behold, bytt og høy tilfredshet. Deterministic.
 */
export function analyzeDishPerformance(input: MenuOptimizerInput): MenuOptimizerOutput {
  const isEn = input.locale === "en";
  const dishes = Array.isArray(input.dishes) ? input.dishes : [];
  const periodLabel = safeStr(input.periodLabel) || (isEn ? "the period" : "perioden");

  const dishesToKeep: DishRecommendation[] = [];
  const dishesToSwap: DishRecommendation[] = [];
  const highSatisfactionDishes: DishRecommendation[] = [];

  for (const d of dishes) {
    const title = safeStr(d.title || d.dishId) || "unknown";
    const dishId = safeStr(d.dishId) || null;
    if (title === "unknown") continue;

    const orderCount = Math.max(0, safeNum(d.orderCount));
    const scale = d.satisfactionScale === "1-5" ? "1-5" : "0-1";
    const rawScore = safeNum(d.satisfactionScore);
    const score01 = rawScore > 0 ? toScore01(rawScore, scale) : 0.5;
    const cancelRate = Math.min(1, Math.max(0, safeNum(d.cancellationRate)));

    const satisfactionHint =
      rawScore > 0
        ? scale === "1-5"
          ? `${rawScore}/5`
          : `${Math.round(rawScore * 100)}%`
        : null;

    const isHighSatisfaction =
      score01 >= SATISFACTION_HIGH_01 && orderCount >= MIN_ORDERS_HIGH_SAT;
    const isLowSatisfaction = rawScore > 0 && score01 < SATISFACTION_LOW_01;
    const isHighCancel = cancelRate >= CANCEL_SWAP_THRESHOLD;
    const isLowOrders = orderCount < MIN_ORDERS_KEEP && orderCount > 0;

    if (isHighSatisfaction) {
      highSatisfactionDishes.push({
        dishId,
        title,
        orderCount,
        satisfactionHint,
        rationale: isEn
          ? "High satisfaction and solid order volume; strong performer."
          : "Høy tilfredshet og godt bestillingsvolum; sterk prestasjon.",
      });
    }

    if (isLowSatisfaction || isHighCancel || (isLowOrders && rawScore > 0 && score01 < 0.6)) {
      const reasons: string[] = [];
      if (isLowSatisfaction) reasons.push(isEn ? "low satisfaction" : "lav tilfredshet");
      if (isHighCancel) reasons.push(isEn ? "high cancellation rate" : "høy avbestillingsandel");
      if (isLowOrders && !isHighSatisfaction) reasons.push(isEn ? "low orders" : "lavt bestillingsvolum");
      dishesToSwap.push({
        dishId,
        title,
        orderCount,
        satisfactionHint,
        rationale: isEn
          ? `Consider swapping: ${reasons.join(", ")}.`
          : `Vurder å bytte ut: ${reasons.join(", ")}.`,
      });
    } else if (!isLowSatisfaction && !isHighCancel && orderCount >= MIN_ORDERS_KEEP) {
      dishesToKeep.push({
        dishId,
        title,
        orderCount,
        satisfactionHint,
        rationale: isEn
          ? "Stable performance; keep on menu."
          : "Stabil prestasjon; behold på menyen.",
      });
    } else if (orderCount >= MIN_ORDERS_KEEP) {
      dishesToKeep.push({
        dishId,
        title,
        orderCount,
        satisfactionHint,
        rationale: isEn
          ? "Acceptable performance; keep unless refreshing menu."
          : "Akseptabel prestasjon; behold med mindre menyen fornyes.",
      });
    }
  }

  const summary = isEn
    ? `Menu optimizer for ${periodLabel}: ${dishesToKeep.length} keep, ${dishesToSwap.length} consider swapping, ${highSatisfactionDishes.length} high satisfaction.`
    : `Menyoptimalisering for ${periodLabel}: ${dishesToKeep.length} behold, ${dishesToSwap.length} vurder å bytte, ${highSatisfactionDishes.length} med høy tilfredshet.`;

  return {
    dishesToKeep,
    dishesToSwap,
    highSatisfactionDishes,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
