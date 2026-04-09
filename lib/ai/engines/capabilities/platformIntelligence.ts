/**
 * AI Platform Intelligence capability: runPlatformIntelligence.
 * Samler alle data i én modell og gir: strategiske anbefalinger, vekstmuligheter.
 * Dette blir selve hjernen i systemet. Deterministic; no LLM.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "platformIntelligence";

const platformIntelligenceCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Platform intelligence: aggregates all data in one model and delivers strategic recommendations and growth opportunities. The brain of the system. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Unified platform model (aggregated data from all domains)",
    properties: {
      keyMetrics: {
        type: "array",
        items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" } } },
      },
      orderTrend: { type: "string", enum: ["up", "down", "stable"], description: "Order volume trend" },
      riskSummary: { type: "string", description: "Aggregated kitchen/delivery risk level" },
      churnRiskCount: { type: "number", description: "Number of entities at churn risk" },
      salesOpportunityCount: { type: "number", description: "Number of identified sales opportunities" },
      satisfactionSummary: { type: "string", description: "Aggregated customer satisfaction" },
      periodLabel: { type: "string" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
  },
  outputSchema: {
    type: "object",
    description: "Strategic recommendations and growth opportunities",
    required: [
      "strategicRecommendations",
      "growthOpportunities",
      "summary",
      "generatedAt",
    ],
    properties: {
      strategicRecommendations: { type: "array", items: { type: "object" } },
      growthOpportunities: { type: "array", items: { type: "object" } },
      summary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "advisory_only",
      description: "Output is strategic advice only; no system or business mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(platformIntelligenceCapability);

export type PlatformModelInput = {
  keyMetrics?: { label?: string | null; value?: string | null }[] | null;
  orderTrend?: "up" | "down" | "stable" | null;
  riskSummary?: string | null;
  churnRiskCount?: number | null;
  salesOpportunityCount?: number | null;
  satisfactionSummary?: string | null;
  periodLabel?: string | null;
  locale?: "nb" | "en" | null;
};

export type StrategicRecommendation = {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  domain: string;
};

export type GrowthOpportunity = {
  id: string;
  title: string;
  description: string;
  impactHint: string;
  domain: string;
};

export type PlatformIntelligenceOutput = {
  strategicRecommendations: StrategicRecommendation[];
  growthOpportunities: GrowthOpportunity[];
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

let idSeq = 0;
function nextId(): string {
  return `pi-${++idSeq}-${Date.now().toString(36)}`;
}

/**
 * Runs platform intelligence: one model, strategic recommendations and growth opportunities. Deterministic.
 * Selve hjernen i systemet.
 */
export function runPlatformIntelligence(
  input: PlatformModelInput
): PlatformIntelligenceOutput {
  const isEn = input.locale === "en";
  const periodLabel = safeStr(input.periodLabel) || (isEn ? "the period" : "perioden");
  const orderTrend = input.orderTrend ?? "stable";
  const riskSummary = safeStr(input.riskSummary).toLowerCase();
  const churnRiskCount = Math.max(0, safeNum(input.churnRiskCount));
  const salesOpportunityCount = Math.max(0, safeNum(input.salesOpportunityCount));

  const strategicRecommendations: StrategicRecommendation[] = [];
  const growthOpportunities: GrowthOpportunity[] = [];

  if (orderTrend === "down") {
    strategicRecommendations.push({
      id: nextId(),
      title: isEn ? "Stem order decline" : "Stopp bestillingsnedgang",
      description: isEn
        ? "Order volume is trending down. Review menus, pricing, and engagement; consider retention and feedback."
        : "Bestillingsvolumet trendet ned. Gjennomgå menyer, prising og engagement; vurder retention og tilbakemeldinger.",
      priority: "high",
      domain: "orders",
    });
  }

  if (churnRiskCount > 0) {
    strategicRecommendations.push({
      id: nextId(),
      title: isEn ? "Address churn risk" : "Adresser frafallsrisiko",
      description: isEn
        ? `${churnRiskCount} entity(ies) at churn risk. Prioritize outreach, satisfaction checks, and contract alignment.`
        : `${churnRiskCount} enhet(er) med frafallsrisiko. Prioriter oppfølging, tilfredshetsundersøkelser og avtaletilpasning.`,
      priority: churnRiskCount >= 3 ? "high" : "medium",
      domain: "customer_analysis",
    });
  }

  if (riskSummary && (riskSummary.includes("high") || riskSummary.includes("warn") || riskSummary.includes("overload"))) {
    strategicRecommendations.push({
      id: nextId(),
      title: isEn ? "Reduce operational risk" : "Reduser operativ risiko",
      description: isEn
        ? "Kitchen or delivery risk is elevated. Review capacity, delivery windows, and volume adjustments."
        : "Kjøkken- eller leveringsrisiko er forhøyet. Gjennomgå kapasitet, leveringsvinduer og volumjusteringer.",
      priority: "high",
      domain: "kitchen",
    });
  }

  if (salesOpportunityCount > 0) {
    growthOpportunities.push({
      id: nextId(),
      title: isEn ? "Capture sales opportunities" : "Utnytt salgsmuligheter",
      description: isEn
        ? `${salesOpportunityCount} company(ies) identified for plan upgrade or volume increase. Act on pipeline.`
        : `${salesOpportunityCount} firma(er) identifisert for planoppgradering eller volumøkning. Handl på pipeline.`,
      impactHint: isEn ? "Revenue and retention upside." : "Inntekts- og retention-potensial.",
      domain: "customer_analysis",
    });
  }

  if (orderTrend === "up") {
    growthOpportunities.push({
      id: nextId(),
      title: isEn ? "Leverage growth momentum" : "Utnytt vekstmoment",
      description: isEn
        ? "Order volume is trending up. Scale menus, capacity, and experience to sustain growth."
        : "Bestillingsvolumet trendet opp. Skaler menyer, kapasitet og opplevelse for å opprettholde vekst.",
      impactHint: isEn ? "Reinforce positive trend." : "Forsterk positiv trend.",
      domain: "orders",
    });
  }

  growthOpportunities.push({
    id: nextId(),
    title: isEn ? "Menu and experience innovation" : "Meny- og opplevelsesinnovasjon",
    description: isEn
      ? "Use trend radar and experience designer for theme days and new dishes; increases engagement."
      : "Bruk trendradar og opplevelsesdesigner for temadager og nye retter; øker engagement.",
    impactHint: isEn ? "Differentiation and satisfaction." : "Differensiering og tilfredshet.",
    domain: "menus",
  });

  if (strategicRecommendations.length === 0) {
    strategicRecommendations.push({
      id: nextId(),
      title: isEn ? "Maintain stability" : "Behold stabilitet",
      description: isEn
        ? "No critical signals in the unified model. Keep monitoring and run regular insight reports."
        : "Ingen kritiske signaler i den samlede modellen. Fortsett overvåkning og kjør jevnlige innsiktsrapporter.",
      priority: "low",
      domain: "operations",
    });
  }

  const recCount = strategicRecommendations.length;
  const oppCount = growthOpportunities.length;
  const summary = isEn
    ? `Platform intelligence (${periodLabel}): ${recCount} strategic recommendation(s), ${oppCount} growth opportunity(ies). Single model, system brain.`
    : `Plattformintelligens (${periodLabel}): ${recCount} strategisk(e) anbefaling(er), ${oppCount} vekstmulighet(er). Én modell, selve hjernen i systemet.`;

  return {
    strategicRecommendations,
    growthOpportunities,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
