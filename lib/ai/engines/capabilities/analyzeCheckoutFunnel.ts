/**
 * Checkout funnel analyzer capability: analyzeCheckoutFunnel.
 * Analyzes checkout funnel from stage counts (cart → shipping → payment → confirmation).
 * Computes drop-off per step, identifies bottleneck, overall conversion rate, and
 * checkout-specific recommendations. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "analyzeCheckoutFunnel";

const analyzeCheckoutFunnelCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Checkout funnel analyzer: analyzes checkout from ordered stage counts (e.g. cart, shipping, payment, confirmation). Computes drop-off per step, identifies bottleneck, overall conversion rate, and returns checkout-specific recommendations (cart abandonment, shipping clarity, payment trust, etc.). Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Analyze checkout funnel input",
    properties: {
      stages: {
        type: "array",
        description: "Checkout stages in order (e.g. cart_views, shipping_starts, payment_starts, confirmations)",
        items: {
          type: "object",
          required: ["id", "name", "count"],
          properties: {
            id: { type: "string", description: "e.g. cart, shipping, payment, confirmation" },
            name: { type: "string" },
            count: { type: "number", description: "Users/sessions at this stage" },
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["stages"],
  },
  outputSchema: {
    type: "object",
    description: "Checkout funnel analysis result",
    required: ["stageMetrics", "bottleneck", "overallConversionRate", "recommendations", "summary", "analyzedAt"],
    properties: {
      stageMetrics: {
        type: "array",
        items: {
          type: "object",
          required: ["stageId", "stageName", "count", "dropOffRate", "conversionRateToNext"],
          properties: {
            stageId: { type: "string" },
            stageName: { type: "string" },
            count: { type: "number" },
            dropOffRate: { type: "number" },
            conversionRateToNext: { type: "number" },
          },
        },
      },
      bottleneck: {
        type: "object",
        required: ["stageId", "stageName", "dropOffRate", "message"],
        properties: {
          stageId: { type: "string" },
          stageName: { type: "string" },
          dropOffRate: { type: "number" },
          message: { type: "string" },
        },
      },
      overallConversionRate: { type: "number", description: "0-1, completions / cart (top)" },
      recommendations: {
        type: "array",
        items: {
          type: "object",
          required: ["stageId", "priority", "message"],
          properties: {
            stageId: { type: "string" },
            priority: { type: "string", enum: ["low", "medium", "high"] },
            message: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
      analyzedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is analysis only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(analyzeCheckoutFunnelCapability);

export type CheckoutStageInput = {
  id: string;
  name: string;
  count: number;
};

export type AnalyzeCheckoutFunnelInput = {
  stages: CheckoutStageInput[];
  locale?: "nb" | "en" | null;
};

export type CheckoutStageMetric = {
  stageId: string;
  stageName: string;
  count: number;
  dropOffRate: number;
  conversionRateToNext: number;
};

export type CheckoutBottleneck = {
  stageId: string;
  stageName: string;
  dropOffRate: number;
  message: string;
};

export type CheckoutRecommendation = {
  stageId: string;
  priority: "low" | "medium" | "high";
  message: string;
};

export type AnalyzeCheckoutFunnelOutput = {
  stageMetrics: CheckoutStageMetric[];
  bottleneck: CheckoutBottleneck;
  overallConversionRate: number;
  recommendations: CheckoutRecommendation[];
  summary: string;
  analyzedAt: string;
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, typeof v === "number" && !Number.isNaN(v) ? v : 0));
}

/** Checkout-specific recommendation messages by stage id (normalized). */
function checkoutRecommendation(
  stageId: string,
  dropOffRate: number,
  isEn: boolean
): { priority: "high" | "medium" | "low"; message: string } {
  const id = stageId.toLowerCase().trim();
  const pct = Math.round(dropOffRate * 100);

  if (id.includes("cart") || id === "cart") {
    if (dropOffRate >= 0.5)
      return {
        priority: "high",
        message: isEn
          ? `Cart drop-off ${pct}%: show shipping cost early, reduce surprises; consider exit-intent or abandoned-cart email.`
          : `Handlevogn-fall ${pct}%: vis fraktkostnad tidlig, reduser overraskelser; vurder exit-intent eller e-post for abonnert vogn.`,
      };
    if (dropOffRate >= 0.3)
      return {
        priority: "medium",
        message: isEn
          ? "Cart: ensure clear total, delivery estimate, and one prominent checkout CTA."
          : "Handlevogn: sikre tydelig total, leveringsestimat og én tydelig kasse-CTA.",
      };
  }

  if (id.includes("shipping") || id === "shipping") {
    if (dropOffRate >= 0.5)
      return {
        priority: "high",
        message: isEn
          ? `Shipping step ${pct}% drop-off: show all costs upfront, offer guest checkout, minimize required fields.`
          : `Fraktsteg ${pct}% fall: vis alle kostnader på forhånd, tilby gjestekasse, minimaliser obligatoriske felt.`,
      };
    if (dropOffRate >= 0.25)
      return {
        priority: "medium",
        message: isEn
          ? "Shipping: pre-fill where possible; show progress (e.g. Step 2 of 3)."
          : "Frakt: forhåndsutfyll der mulig; vis fremdrift (f.eks. Steg 2 av 3).",
      };
  }

  if (id.includes("payment") || id === "payment") {
    if (dropOffRate >= 0.5)
      return {
        priority: "high",
        message: isEn
          ? `Payment step ${pct}% drop-off: add trust badges, secure payment labels, and clear order summary; consider saved payment methods.`
          : `Betalingssteg ${pct}% fall: legg til tillitsmerker, sikre betalingsetiketter og tydelig ordreoppsummering; vurder lagrede betalingsmetoder.`,
      };
    if (dropOffRate >= 0.25)
      return {
        priority: "medium",
        message: isEn
          ? "Payment: display security and refund policy near submit button."
          : "Betaling: vis sikkerhet og returpolicy nær innsendingsknappen.",
      };
  }

  if (id.includes("confirm") || id === "confirmation") {
    if (dropOffRate >= 0.3)
      return {
        priority: "high",
        message: isEn
          ? "Confirmation: ensure clear success state and next steps (e.g. order number, email receipt)."
          : "Bekreftelse: sikre tydelig suksess og neste steg (f.eks. ordrenummer, e-postkvittering).",
      };
  }

  if (dropOffRate >= 0.5)
    return {
      priority: "high",
      message: isEn
        ? `High drop-off (${pct}%) at "${stageId}": simplify step, reduce choices, add reassurance.`
        : `Høyt fall (${pct}%) ved «${stageId}»: forenkle steg, reduser valg, legg til beroligelse.`,
    };
  if (dropOffRate >= 0.3)
    return {
      priority: "medium",
      message: isEn
        ? `Moderate drop-off at "${stageId}": improve clarity and trust on this step.`
        : `Moderat fall ved «${stageId}»: forbedre tydelighet og tillit på dette steg.`,
    };
  return {
    priority: "low",
    message: isEn ? "Checkout flow within expected range; keep monitoring." : "Kasseflyt innenfor forventet område; fortsett å overvåke.",
  };
}

/**
 * Analyzes checkout funnel from ordered stage counts. Checkout-specific recommendations.
 * Deterministic; no external calls.
 */
export function analyzeCheckoutFunnel(input: AnalyzeCheckoutFunnelInput): AnalyzeCheckoutFunnelOutput {
  const isEn = input.locale === "en";
  const stages = Array.isArray(input.stages) ? input.stages : [];
  const valid = stages
    .map((s) => ({
      id: (s.id ?? "").toString().trim(),
      name: (s.name ?? "").toString().trim(),
      count: Math.max(0, Math.floor(Number(s.count) ?? 0)),
    }))
    .filter((s) => s.id);

  const stageMetrics: CheckoutStageMetric[] = [];
  let bottleneck: CheckoutBottleneck = {
    stageId: "",
    stageName: "",
    dropOffRate: 0,
    message: isEn ? "No checkout data." : "Ingen kassedata.",
  };

  const topCount = valid[0]?.count ?? 0;
  const conversionCount = valid.length > 0 ? (valid[valid.length - 1]?.count ?? 0) : 0;
  const overallConversionRate = topCount > 0 ? clamp01(conversionCount / topCount) : 0;

  let maxDropOff = 0;

  for (let i = 0; i < valid.length; i++) {
    const curr = valid[i];
    const nextCount = valid[i + 1]?.count ?? 0;
    const currCount = curr.count;
    const dropOffRate = currCount > 0 ? clamp01(1 - nextCount / currCount) : 0;
    const conversionRateToNext = currCount > 0 ? clamp01(nextCount / currCount) : 0;

    stageMetrics.push({
      stageId: curr.id,
      stageName: curr.name,
      count: currCount,
      dropOffRate,
      conversionRateToNext,
    });

    if (i < valid.length - 1 && dropOffRate > maxDropOff) {
      maxDropOff = dropOffRate;
      bottleneck = {
        stageId: curr.id,
        stageName: curr.name,
        dropOffRate,
        message: isEn
          ? `Largest drop-off (${Math.round(dropOffRate * 100)}%) between "${curr.name}" and next step.`
          : `Størst fall (${Math.round(dropOffRate * 100)}%) mellom «${curr.name}» og neste steg.`,
      };
    }
  }

  const recommendations: CheckoutRecommendation[] = [];
  if (bottleneck.stageId && bottleneck.dropOffRate > 0) {
    const rec = checkoutRecommendation(bottleneck.stageId, bottleneck.dropOffRate, isEn);
    recommendations.push({
      stageId: bottleneck.stageId,
      priority: rec.priority,
      message: rec.message,
    });
  }
  if (overallConversionRate > 0 && overallConversionRate < 0.1 && valid.length >= 2) {
    recommendations.push({
      stageId: valid[0].id,
      priority: "medium",
      message: isEn
        ? "Overall checkout conversion is low; review cart entry and first-step friction."
        : "Samlet kassekonvertering er lav; vurder handlevogn-inngang og friksjon i første steg.",
    });
  }
  for (const m of stageMetrics) {
    if (m.dropOffRate >= 0.4 && m.stageId !== bottleneck.stageId) {
      const rec = checkoutRecommendation(m.stageId, m.dropOffRate, isEn);
      if (rec.priority !== "low" && !recommendations.some((r) => r.stageId === m.stageId))
        recommendations.push({ stageId: m.stageId, priority: rec.priority, message: rec.message });
    }
  }
  if (recommendations.length === 0 && valid.length > 0) {
    recommendations.push({
      stageId: valid[0].id,
      priority: "low",
      message: isEn ? "Checkout funnel within expected range; keep monitoring." : "Kassetrakt innenfor forventet område; fortsett å overvåke.",
    });
  }

  const summary = isEn
    ? `Checkout: ${valid.length} steps, ${Math.round(overallConversionRate * 100)}% cart-to-completion. Bottleneck: ${bottleneck.stageName} (${Math.round((bottleneck.dropOffRate ?? 0) * 100)}% drop-off).`
    : `Kasse: ${valid.length} steg, ${Math.round(overallConversionRate * 100)}% handlevogn-til-fullføring. Flaskehals: ${bottleneck.stageName} (${Math.round((bottleneck.dropOffRate ?? 0) * 100)}% fall).`;

  return {
    stageMetrics,
    bottleneck,
    overallConversionRate,
    recommendations,
    summary,
    analyzedAt: new Date().toISOString(),
  };
}

export { analyzeCheckoutFunnelCapability, CAPABILITY_NAME };
