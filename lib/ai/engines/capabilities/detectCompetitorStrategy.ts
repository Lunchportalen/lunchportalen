/**
 * Competitor strategy detector capability: detectCompetitorStrategy.
 * Infers competitor strategy from signals (pricing, channels, messaging, target segment, differentiation).
 * Returns strategy type, positioning, strengths/weaknesses, and recommendations. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectCompetitorStrategy";

const detectCompetitorStrategyCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Detects competitor strategy from signals: pricing approach, channel focus, messaging themes, target segment, and differentiation claims. Returns strategy type (cost_leader, differentiation, niche, hybrid), positioning, strengths/weaknesses, and recommendations. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Competitor strategy detection input",
    properties: {
      competitorName: { type: "string", description: "Competitor identifier" },
      signals: {
        type: "object",
        description: "Observed signals",
        properties: {
          pricingApproach: { type: "string", enum: ["low_cost", "premium", "mid_market", "value_bundle", "unknown"] },
          channelFocus: { type: "array", items: { type: "string" }, description: "e.g. paid_search, social, direct, partner" },
          messagingThemes: { type: "array", items: { type: "string" }, description: "e.g. price, quality, convenience, trust" },
          targetSegment: { type: "string", description: "e.g. smb, enterprise, consumer" },
          differentiationClaims: { type: "array", items: { type: "string" } },
        },
      },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["signals"],
  },
  outputSchema: {
    type: "object",
    description: "Competitor strategy detection result",
    required: ["strategyType", "positioning", "strengths", "weaknesses", "recommendations", "summary", "generatedAt"],
    properties: {
      strategyType: { type: "string", enum: ["cost_leader", "differentiation", "niche", "hybrid", "unclear"] },
      positioning: { type: "string" },
      strengths: { type: "array", items: { type: "string" } },
      weaknesses: { type: "array", items: { type: "string" } },
      recommendations: { type: "array", items: { type: "string" } },
      signalsUsed: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is analysis only; no competitor or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(detectCompetitorStrategyCapability);

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

export type CompetitorSignalsInput = {
  pricingApproach?: "low_cost" | "premium" | "mid_market" | "value_bundle" | "unknown" | null;
  channelFocus?: string[] | null;
  messagingThemes?: string[] | null;
  targetSegment?: string | null;
  differentiationClaims?: string[] | null;
};

export type DetectCompetitorStrategyInput = {
  competitorName?: string | null;
  signals: CompetitorSignalsInput;
  locale?: "nb" | "en" | null;
};

export type DetectCompetitorStrategyOutput = {
  strategyType: "cost_leader" | "differentiation" | "niche" | "hybrid" | "unclear";
  positioning: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  signalsUsed: string[];
  summary: string;
  generatedAt: string;
};

/**
 * Detects competitor strategy from signals. Deterministic; no external calls.
 */
export function detectCompetitorStrategy(input: DetectCompetitorStrategyInput): DetectCompetitorStrategyOutput {
  const isEn = input.locale === "en";
  const name = safeStr(input.competitorName) || "competitor";
  const s = input.signals && typeof input.signals === "object" ? input.signals : {};

  const pricing = s.pricingApproach ?? "unknown";
  const channels = Array.isArray(s.channelFocus) ? s.channelFocus.map(safeStr) : [];
  const themes = Array.isArray(s.messagingThemes) ? s.messagingThemes.map(safeStr) : [];
  const segment = safeStr(s.targetSegment);
  const claims = Array.isArray(s.differentiationClaims) ? s.differentiationClaims.map(safeStr) : [];

  const signalsUsed: string[] = [];
  if (pricing !== "unknown") signalsUsed.push(`pricing:${pricing}`);
  if (channels.length > 0) signalsUsed.push(`channels:${channels.join(",")}`);
  if (themes.length > 0) signalsUsed.push(`themes:${themes.join(",")}`);
  if (segment) signalsUsed.push(`segment:${segment}`);
  if (claims.length > 0) signalsUsed.push(`differentiation:${claims.length}`);

  let strategyType: DetectCompetitorStrategyOutput["strategyType"] = "unclear";
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  if (pricing === "low_cost") {
    strategyType = "cost_leader";
    strengths.push(isEn ? "Price-sensitive appeal; volume potential." : "Prisbevisst appell; volumpotensial.");
    weaknesses.push(isEn ? "Margin pressure; commoditization risk." : "Marginspress; kommoditiseringsrisiko.");
    recommendations.push(isEn ? "Differentiate on quality, control, or service; avoid pure price war." : "Differentier på kvalitet, kontroll eller service; unngå ren priskrig.");
  }

  if (pricing === "premium" || themes.some((t) => t.includes("quality") || t.includes("premium"))) {
    if (strategyType === "cost_leader") strategyType = "hybrid";
    else strategyType = "differentiation";
    strengths.push(isEn ? "Premium positioning; margin resilience." : "Premium posisjonering; marginmotstand.");
    weaknesses.push(isEn ? "Narrower addressable market." : "Smalere adresserbar marked.");
  }

  if (segment && (segment.includes("enterprise") || segment.includes("smb") || segment.includes("niche"))) {
    if (strategyType === "unclear") strategyType = "niche";
    else if (strategyType !== "hybrid") strategyType = strategyType === "cost_leader" ? "hybrid" : "niche";
    strengths.push(isEn ? "Focused segment; clear positioning." : "Fokusert segment; tydelig posisjonering.");
    weaknesses.push(isEn ? "Segment dependency; growth ceiling." : "Segmentavhengighet; tak på vekst.");
  }

  if (channels.length > 1 && channels.some((c) => c.includes("partner") || c.includes("direct"))) {
    strengths.push(isEn ? "Multi-channel presence." : "Flerkanals tilstedeværelse.");
  }
  if (channels.length === 1 && channels[0]) {
    weaknesses.push(isEn ? "Single-channel reliance; diversify for resilience." : "Enkelkanals avhengighet; diversifiser for robusthet.");
  }

  if (themes.some((t) => t.includes("trust") || t.includes("control"))) {
    strengths.push(isEn ? "Trust/control messaging aligns with B2B and compliance." : "Tillit/kontroll-budskap passer B2B og compliance.");
  }

  if (claims.length > 2) {
    strengths.push(isEn ? "Clear differentiation narrative." : "Tydelig differensieringsnarrativ.");
  }
  if (claims.length === 0 && strategyType !== "cost_leader") {
    weaknesses.push(isEn ? "Differentiation not clearly communicated." : "Differensiering ikke tydelig kommunisert.");
  }

  if (strategyType === "unclear" && (pricing !== "unknown" || themes.length > 0)) {
    strategyType = pricing === "mid_market" || pricing === "value_bundle" ? "hybrid" : "differentiation";
  }

  const positioning =
    strategyType === "cost_leader"
      ? (isEn ? "Cost leadership: compete on price and efficiency." : "Kostnadsledelse: konkurrerer på pris og effektivitet.")
      : strategyType === "differentiation"
        ? (isEn ? "Differentiation: compete on quality, brand, or unique value." : "Differensiering: konkurrerer på kvalitet, merke eller unik verdi.")
        : strategyType === "niche"
          ? (isEn ? "Niche: focused on specific segment or use case." : "Nische: fokus på spesifikt segment eller bruksområde.")
          : strategyType === "hybrid"
            ? (isEn ? "Hybrid: mix of cost and differentiation or segment focus." : "Hybrid: blanding av kostnad og differensiering eller segmentfokus.")
            : (isEn ? "Insufficient signals to classify strategy." : "Utilstrekkelige signaler for å klassifisere strategi.");

  const summary = isEn
    ? `Competitor strategy: ${strategyType}. ${strengths.length} strength(s), ${weaknesses.length} weakness(es). ${recommendations.length} recommendation(s).`
    : `Konkurrentestrategi: ${strategyType}. ${strengths.length} styrke(r), ${weaknesses.length} svakhet(er). ${recommendations.length} anbefaling(er).`;

  return {
    strategyType,
    positioning,
    strengths: [...new Set(strengths)],
    weaknesses: [...new Set(weaknesses)],
    recommendations: [...new Set(recommendations)],
    signalsUsed,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { detectCompetitorStrategyCapability, CAPABILITY_NAME };
