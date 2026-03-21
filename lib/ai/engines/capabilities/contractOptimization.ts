/**
 * AI Contract Intelligence / Pricing Insight / Contract Optimization: suggestContractOptimizations.
 * Analyserer kontrakter og bruksmønster for å foreslå bedre avtalestruktur.
 * Deterministic; no LLM.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "contractOptimization";

const contractOptimizationCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Contract intelligence: analyzes contracts and usage patterns to suggest better agreement structure (level, pricing, delivery frequency). Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Contract/agreement summary and usage pattern",
    properties: {
      priceStructure: {
        type: "string",
        enum: ["per_order", "fixed_weekly", "fixed_monthly", "tiered", "unknown"],
        description: "Current pricing model",
      },
      currentLevel: {
        type: "string",
        enum: ["basis", "luksus", "unknown"],
        description: "Basis vs luksus nivå",
      },
      deliveryFrequencyDaysPerWeek: { type: "number", description: "e.g. 3 for 3 days/week" },
      averageOrdersPerWeek: { type: "number" },
      companySize: { type: "number", description: "Approx. employees" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["averageOrdersPerWeek", "deliveryFrequencyDaysPerWeek"],
  },
  outputSchema: {
    type: "object",
    description: "Contract optimization suggestions",
    required: [
      "priceStructureSuggestions",
      "recommendedLevel",
      "optimalDeliveryFrequency",
      "summary",
      "generatedAt",
    ],
    properties: {
      priceStructureSuggestions: { type: "array", items: { type: "object" } },
      recommendedLevel: { type: "object" },
      optimalDeliveryFrequency: { type: "object" },
      summary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "suggestion_only",
      description: "Output is optimization suggestions only; no contract or system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(contractOptimizationCapability);

export type PriceStructureType = "per_order" | "fixed_weekly" | "fixed_monthly" | "tiered" | "unknown";
export type AgreementLevel = "basis" | "luksus" | "unknown";

export type ContractOptimizationInput = {
  priceStructure?: PriceStructureType | null;
  currentLevel?: AgreementLevel | null;
  deliveryFrequencyDaysPerWeek: number;
  averageOrdersPerWeek: number;
  companySize?: number | null;
  locale?: "nb" | "en" | null;
};

export type PriceStructureSuggestion = {
  suggestedStructure: PriceStructureType;
  title: string;
  rationale: string;
  impactHint: string;
};

export type RecommendedLevelOutput = {
  level: "basis" | "luksus";
  title: string;
  rationale: string;
  impactHint: string;
};

export type OptimalDeliveryOutput = {
  recommendedDaysPerWeek: number;
  title: string;
  rationale: string;
  impactHint: string;
};

export type ContractOptimizationOutput = {
  priceStructureSuggestions: PriceStructureSuggestion[];
  recommendedLevel: RecommendedLevelOutput;
  optimalDeliveryFrequency: OptimalDeliveryOutput;
  summary: string;
  generatedAt: string;
};

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Suggests contract optimizations: price structure, level (basis vs luksus), delivery frequency. Deterministic.
 */
export function suggestContractOptimizations(
  input: ContractOptimizationInput
): ContractOptimizationOutput {
  const isEn = input.locale === "en";
  const ordersPerWeek = Math.max(0, safeNum(input.averageOrdersPerWeek));
  const deliveryDays = Math.max(0, Math.min(7, safeNum(input.deliveryFrequencyDaysPerWeek)));
  const companySize = Math.max(0, safeNum(input.companySize));
  const currentPrice = input.priceStructure ?? "unknown";
  const currentLevel = input.currentLevel ?? "unknown";

  const priceStructureSuggestions: PriceStructureSuggestion[] = [];

  if (ordersPerWeek >= 50 && (currentPrice === "per_order" || currentPrice === "unknown")) {
    priceStructureSuggestions.push(
      isEn
        ? {
            suggestedStructure: "tiered",
            title: "Tiered pricing",
            rationale: "High weekly volume; tiered or fixed pricing can reduce admin and give predictable cost.",
            impactHint: "Consider volume brackets or fixed weekly fee with included orders.",
          }
        : {
            suggestedStructure: "tiered",
            title: "Trinnprising",
            rationale: "Høyt ukentlig volum; trinnprising eller fast pris kan redusere administrasjon og gi forutsigbar kostnad.",
            impactHint: "Vurder volumtrinn eller fast ukentlig avgift med inkluderte bestillinger.",
          }
    );
  }
  if (ordersPerWeek >= 100 && (currentPrice === "per_order" || currentPrice === "tiered")) {
    priceStructureSuggestions.push(
      isEn
        ? {
            suggestedStructure: "fixed_weekly",
            title: "Fixed weekly price",
            rationale: "Very high volume; fixed weekly price simplifies invoicing and often gives better unit cost.",
            impactHint: "Agree a weekly cap or fixed fee with volume included.",
          }
        : {
            suggestedStructure: "fixed_weekly",
            title: "Fast ukentlig pris",
            rationale: "Svært høyt volum; fast ukentlig pris forenkler fakturering og gir ofte bedre enhetskostnad.",
            impactHint: "Avtalt ukentlig tak eller fast avgift med inkludert volum.",
          }
    );
  }
  if (ordersPerWeek < 20 && (currentPrice === "fixed_weekly" || currentPrice === "fixed_monthly")) {
    priceStructureSuggestions.push(
      isEn
        ? {
            suggestedStructure: "per_order",
            title: "Per-order pricing",
            rationale: "Lower volume; per-order pricing avoids overpaying when orders fluctuate.",
            impactHint: "Switch to per-order or small minimum to align cost with actual use.",
          }
        : {
            suggestedStructure: "per_order",
            title: "Pr. bestilling",
            rationale: "Lavere volum; pris pr. bestilling unngår at kunden betaler for ubenyttet kapasitet.",
            impactHint: "Bytt til pr. bestilling eller lav minimumsordre for å tilpasse kostnad til faktisk bruk.",
          }
    );
  }
  if (priceStructureSuggestions.length === 0) {
    priceStructureSuggestions.push(
      isEn
        ? {
            suggestedStructure: currentPrice !== "unknown" ? currentPrice : "per_order",
            title: "Current structure is reasonable",
            rationale: "No strong signal to change price structure; review if volume or usage pattern changes.",
            impactHint: "Keep as is unless order pattern shifts.",
          }
        : {
            suggestedStructure: currentPrice !== "unknown" ? currentPrice : "per_order",
            title: "Nåværende struktur er rimelig",
            rationale: "Ingen tydelig signal for å endre prisstruktur; vurder ved endring i volum eller bruksmønster.",
            impactHint: "Behold inntil bestillingsmønsteret endres.",
          }
    );
  }

  const recommendedLevel: RecommendedLevelOutput =
    companySize >= 50 && ordersPerWeek >= 30
      ? isEn
        ? {
            level: "luksus",
            title: "Luxury level",
            rationale: "Larger company with solid volume; luxury tier can support variety and perceived value.",
            impactHint: "Offer premium options and varied menus to match expectations.",
          }
        : {
            level: "luksus",
            title: "Luksusnivå",
            rationale: "Større selskap med godt volum; luksusnivå støtter variasjon og opplevd verdi.",
            impactHint: "Tilby premium-alternativer og varierte menyer som matcher forventningene.",
          }
      : isEn
        ? {
            level: "basis",
            title: "Basic level",
            rationale: "Basic tier fits most small to mid-size offices; upgrade path when volume grows.",
            impactHint: "Keep quality high within basic range; suggest luxury when volume and size justify it.",
          }
        : {
            level: "basis",
            title: "Basisnivå",
            rationale: "Basisnivå passer de fleste små til mellomstore kontor; oppgradering når volumet øker.",
            impactHint: "Behold god kvalitet innenfor basis; foreslå luksus når volum og størrelse tilsier det.",
          };

  let recommendedDays = deliveryDays;
  if (ordersPerWeek >= 40 && deliveryDays < 5) {
    recommendedDays = Math.min(5, Math.max(deliveryDays, 3));
  } else if (ordersPerWeek < 15 && deliveryDays > 3) {
    recommendedDays = Math.max(2, Math.min(3, deliveryDays));
  } else if (deliveryDays === 0 && ordersPerWeek > 0) {
    recommendedDays = ordersPerWeek >= 20 ? 3 : 2;
  }

  const optimalDeliveryFrequency: OptimalDeliveryOutput =
    recommendedDays > deliveryDays
      ? isEn
        ? {
            recommendedDaysPerWeek: recommendedDays,
            title: "Increase delivery frequency",
            rationale: `With ${ordersPerWeek} orders/week, ${recommendedDays} days can balance demand and logistics.`,
            impactHint: "More delivery days can reduce peak load and improve freshness.",
          }
        : {
            recommendedDaysPerWeek: recommendedDays,
            title: "Øk leveringsfrekvens",
            rationale: `Med ${ordersPerWeek} bestillinger/uke kan ${recommendedDays} dager balansere etterspørsel og logistikk.`,
            impactHint: "Flere leveringsdager kan jevne ut toppbelastning og bedre ferskhet.",
          }
      : recommendedDays < deliveryDays
        ? isEn
          ? {
              recommendedDaysPerWeek: recommendedDays,
              title: "Reduce delivery frequency",
              rationale: `With ${ordersPerWeek} orders/week, ${recommendedDays} days may suffice and reduce cost.`,
              impactHint: "Fewer days can lower logistics cost; ensure order deadlines are clear.",
            }
          : {
              recommendedDaysPerWeek: recommendedDays,
              title: "Reduser leveringsfrekvens",
              rationale: `Med ${ordersPerWeek} bestillinger/uke kan ${recommendedDays} dager være nok og redusere kostnad.`,
              impactHint: "Færre dager kan senke logistikkostnad; sørg for tydelige bestillingsfrister.",
            }
        : isEn
          ? {
              recommendedDaysPerWeek: recommendedDays,
              title: "Current frequency is appropriate",
              rationale: `${deliveryDays} days/week matches current volume (${ordersPerWeek} orders/week).`,
              impactHint: "Revisit if order volume or company size changes significantly.",
            }
          : {
              recommendedDaysPerWeek: recommendedDays,
              title: "Nåværende frekvens er passende",
              rationale: `${deliveryDays} dager/uke matcher nåværende volum (${ordersPerWeek} bestillinger/uke).`,
              impactHint: "Vurder på nytt ved vesentlig endring i bestillingsvolum eller selskapsstørrelse.",
            };

  const summary = isEn
    ? `Contract optimization: ${priceStructureSuggestions.length} price structure suggestion(s), recommended level ${recommendedLevel.level}, optimal delivery ${optimalDeliveryFrequency.recommendedDaysPerWeek} days/week.`
    : `Avtaleoptimalisering: ${priceStructureSuggestions.length} forslag til prisstruktur, anbefalt nivå ${recommendedLevel.level}, optimal levering ${optimalDeliveryFrequency.recommendedDaysPerWeek} dager/uke.`;

  return {
    priceStructureSuggestions,
    recommendedLevel,
    optimalDeliveryFrequency,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
