/**
 * Product trust optimizer capability: optimizeProductTrust.
 * Evaluates product/page trust signals and suggests optimizations: gaps (missing elements),
 * prioritized recommendations, and a trust score. Product-focused; deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "optimizeProductTrust";

const optimizeProductTrustCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Product trust optimizer: evaluates product or page trust signals and returns a trust score (0-100), gaps (missing elements), and prioritized recommendations (testimonials, guarantees, certifications, social proof). Product-focused; deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Optimize product trust input",
    properties: {
      product: {
        type: "object",
        description: "Product context (name, description, price, category)",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          price: { type: "string" },
          category: { type: "string" },
        },
      },
      existingTrustSignals: {
        type: "array",
        description: "Trust elements already present (e.g. testimonials, guarantees, certifications, reviews, stats)",
        items: { type: "string" },
      },
      plainText: { type: "string", description: "Optional page/content text to scan for trust keywords" },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Product trust optimization result",
    required: ["trustScore", "gaps", "recommendations", "summary"],
    properties: {
      trustScore: { type: "number", description: "0-100 (higher = stronger trust signals)" },
      gaps: {
        type: "array",
        description: "Missing trust dimensions",
        items: {
          type: "object",
          required: ["dimension", "message", "priority"],
          properties: {
            dimension: { type: "string" },
            message: { type: "string" },
            priority: { type: "string", description: "high | medium | low" },
          },
        },
      },
      recommendations: {
        type: "array",
        description: "Prioritized actions to improve trust",
        items: {
          type: "object",
          required: ["action", "message", "priority"],
          properties: {
            action: { type: "string" },
            message: { type: "string" },
            priority: { type: "string" },
            placementHint: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is optimization suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(optimizeProductTrustCapability);

export type OptimizeProductTrustProductInput = {
  name?: string | null;
  description?: string | null;
  price?: string | null;
  category?: string | null;
};

export type OptimizeProductTrustInput = {
  product?: OptimizeProductTrustProductInput | null;
  existingTrustSignals?: string[] | null;
  plainText?: string | null;
  locale?: "nb" | "en" | null;
};

export type TrustGap = {
  dimension: string;
  message: string;
  priority: "high" | "medium" | "low";
};

export type TrustRecommendation = {
  action: string;
  message: string;
  priority: "high" | "medium" | "low";
  placementHint?: string | null;
};

export type OptimizeProductTrustOutput = {
  trustScore: number;
  gaps: TrustGap[];
  recommendations: TrustRecommendation[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const TRUST_DIMENSIONS = [
  { key: "testimonials", weight: 25, labelEn: "Testimonials", labelNb: "Tilbakemeldinger", hintEn: "After benefits or before CTA.", hintNb: "Etter fordeler eller før CTA." },
  { key: "guarantees", weight: 20, labelEn: "Guarantees", labelNb: "Garantier", hintEn: "Near CTA or in dedicated section.", hintNb: "Nær CTA eller i egen seksjon." },
  { key: "reviews", weight: 20, labelEn: "Reviews / ratings", labelNb: "Anmeldelser / vurderinger", hintEn: "On product or above fold.", hintNb: "På produktet eller over brettet." },
  { key: "certifications", weight: 15, labelEn: "Certifications / badges", labelNb: "Sertifiseringer / merker", hintEn: "Footer or near trust copy.", hintNb: "Footer eller nær tillitskopi." },
  { key: "stats", weight: 10, labelEn: "Stats / social proof numbers", labelNb: "Tall / sosiale bevis", hintEn: "Hero or under intro.", hintNb: "I hero eller under intro." },
  { key: "secure_payment", weight: 5, labelEn: "Secure payment / return policy", labelNb: "Sikker betaling / returpolicy", hintEn: "Checkout or footer.", hintNb: "Kasse eller footer." },
  { key: "case_studies", weight: 5, labelEn: "Case studies", labelNb: "Casestudier", hintEn: "After main content, before CTA.", hintNb: "Etter hovedinnhold, før CTA." },
] as const;

function normalizeSignal(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, "_");
}

/**
 * Evaluates product trust and returns score, gaps, and recommendations. Deterministic; no external calls.
 */
export function optimizeProductTrust(input: OptimizeProductTrustInput = {}): OptimizeProductTrustOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const product = input.product && typeof input.product === "object" ? input.product : {};
  const plainText = safeStr(input.plainText).toLowerCase();
  const existingRaw = Array.isArray(input.existingTrustSignals)
    ? input.existingTrustSignals.map((s) => normalizeSignal(String(s)))
    : [];
  const existingSet = new Set(existingRaw);

  const hasKeyword = (keywords: string[]) => keywords.some((k) => plainText.includes(k));
  const trustKeywordsEn: Record<string, string[]> = {
    testimonials: ["testimonial", "review", "customer said", "quote", "feedback"],
    guarantees: ["guarantee", "money-back", "warranty", "no commitment", "price guarantee"],
    reviews: ["review", "rating", "stars", "verified"],
    certifications: ["certified", "certification", "badge", "iso", "approved"],
    stats: ["customers", "years", "satisfaction", "reduced", "percent"],
    secure_payment: ["secure payment", "ssl", "return policy", "refund", "safe"],
    case_studies: ["case study", "success story", "result"],
  };
  const trustKeywordsNb: Record<string, string[]> = {
    testimonials: ["tilbakemelding", "anmeldelse", "kunde", "sitat", "feedback"],
    guarantees: ["garanti", "pengene tilbake", "ingen binding", "prisgaranti"],
    reviews: ["anmeldelse", "vurdering", "stjerner", "verifisert"],
    certifications: ["sertifisert", "sertifisering", "merke", "godkjent"],
    stats: ["kunder", "år", "tilfredshet", "redusert", "prosent"],
    secure_payment: ["sikker betaling", "returpolicy", "refusjon", "trygt"],
    case_studies: ["casestudie", "suksesshistorie", "resultat"],
  };
  const keywordMap = isEn ? trustKeywordsEn : trustKeywordsNb;

  let score = 0;
  const gaps: TrustGap[] = [];
  const recommendations: TrustRecommendation[] = [];

  const aliasMap: Record<string, string> = {
    testimonial: "testimonials",
    reviews: "reviews",
    rating: "reviews",
    guarantee: "guarantees",
    warranty: "guarantees",
    certification: "certifications",
    badge: "certifications",
    stat: "stats",
    stats: "stats",
    numbers: "stats",
    secure: "secure_payment",
    payment: "secure_payment",
    return: "secure_payment",
    case_study: "case_studies",
    case_studies: "case_studies",
  };

  for (const dim of TRUST_DIMENSIONS) {
    const hasInList = existingSet.has(dim.key) || existingRaw.some((s) => aliasMap[s] === dim.key);
    const hasInText = plainText ? hasKeyword(keywordMap[dim.key] ?? []) : false;
    const present = hasInList || hasInText;

    if (present) {
      score += dim.weight;
    } else {
      const label = isEn ? dim.labelEn : dim.labelNb;
      const priority: TrustGap["priority"] = dim.weight >= 20 ? "high" : dim.weight >= 10 ? "medium" : "low";
      gaps.push({
        dimension: label,
        message: isEn ? `No ${dim.key} signal detected.` : `Ingen ${dim.key}-signal oppdaget.`,
        priority,
      });
      recommendations.push({
        action: isEn ? `Add ${label.toLowerCase()}` : `Legg til ${label.toLowerCase()}`,
        message: isEn ? `Strengthen trust with ${dim.key}.` : `Styrk tillit med ${dim.key}.`,
        priority,
        placementHint: isEn ? dim.hintEn : dim.hintNb,
      });
    }
  }

  const trustScore = Math.max(0, Math.min(100, score));
  recommendations.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
  });

  const summary = isEn
    ? `Trust score: ${trustScore}/100. ${gaps.length} gap(s). ${gaps.length === 0 ? "Trust signals are strong." : "Apply recommendations to improve."}`
    : `Tillitsscore: ${trustScore}/100. ${gaps.length} hull(er). ${gaps.length === 0 ? "Tillitssignaler er gode." : "Bruk anbefalingene for å forbedre."}`;

  return {
    trustScore,
    gaps,
    recommendations,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { optimizeProductTrustCapability, CAPABILITY_NAME };
