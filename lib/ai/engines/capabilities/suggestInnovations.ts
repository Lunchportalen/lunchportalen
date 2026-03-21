/**
 * Innovation suggestion AI capability: suggestInnovations.
 * Suggests innovations from trends, gaps, strengths, constraints, and industry context.
 * Returns categorized innovations with impact area, rationale, and horizon. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "suggestInnovations";

const suggestInnovationsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Suggests innovations from trends, market gaps, strengths, and constraints. Returns categorized innovations (product, process, experience, business_model, technology) with impact area, rationale, and horizon. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Innovation suggestion input",
    properties: {
      industry: { type: "string", description: "Industry or domain context" },
      trends: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            direction: { type: "string", enum: ["up", "down", "stable"] },
            strength: { type: "string", enum: ["weak", "moderate", "strong"] },
          },
        },
      },
      gaps: { type: "array", items: { type: "string" }, description: "Market or product gaps" },
      strengths: { type: "array", items: { type: "string" } },
      constraints: { type: "array", items: { type: "string" } },
      goals: { type: "array", items: { type: "string" } },
      locale: { type: "string", enum: ["nb", "en"] },
    },
  },
  outputSchema: {
    type: "object",
    description: "Innovation suggestion result",
    required: ["innovations", "summary", "generatedAt"],
    properties: {
      innovations: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "title", "description", "category", "impactArea", "rationale", "horizon"],
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            category: { type: "string", enum: ["product", "process", "experience", "business_model", "technology"] },
            impactArea: { type: "string" },
            rationale: { type: "string" },
            horizon: { type: "string", enum: ["short", "medium", "long"] },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is suggestions only; no product or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(suggestInnovationsCapability);

const CATEGORIES = ["product", "process", "experience", "business_model", "technology"] as const;

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export type TrendInput = {
  name?: string | null;
  direction?: string | null;
  strength?: string | null;
};

export type SuggestInnovationsInput = {
  industry?: string | null;
  trends?: TrendInput[] | null;
  gaps?: string[] | null;
  strengths?: string[] | null;
  constraints?: string[] | null;
  goals?: string[] | null;
  locale?: "nb" | "en" | null;
};

export type InnovationSuggestion = {
  id: string;
  title: string;
  description: string;
  category: (typeof CATEGORIES)[number];
  impactArea: string;
  rationale: string;
  horizon: "short" | "medium" | "long";
};

export type SuggestInnovationsOutput = {
  innovations: InnovationSuggestion[];
  summary: string;
  generatedAt: string;
};

/**
 * Suggests innovations from trends, gaps, strengths, and constraints. Deterministic; no external calls.
 */
export function suggestInnovations(input: SuggestInnovationsInput): SuggestInnovationsOutput {
  const isEn = input.locale === "en";
  const industry = safeStr(input.industry);
  const trends = Array.isArray(input.trends) ? input.trends.filter((t) => t && typeof t === "object") : [];
  const gaps = Array.isArray(input.gaps) ? input.gaps.map(safeStr).filter(Boolean) : [];
  const strengths = Array.isArray(input.strengths) ? input.strengths.map(safeStr).filter(Boolean) : [];
  const goals = Array.isArray(input.goals) ? input.goals.map(safeStr).filter(Boolean) : [];

  const innovations: InnovationSuggestion[] = [];
  let idSeq = 1;

  const upTrends = trends.filter((t) => safeStr(t.direction) === "up" && (safeStr(t.strength) === "moderate" || safeStr(t.strength) === "strong"));
  for (const t of upTrends) {
    const name = safeStr(t.name);
    if (!name) continue;
    innovations.push({
      id: `inn-${idSeq++}`,
      title: isEn ? `Leverage trend: ${name}` : `Utnytt trend: ${name}`,
      description: isEn ? `Align product or process with rising trend "${name}" for differentiation or growth.` : `Juster produkt eller prosess til stigende trend «${name}» for differensiering eller vekst.`,
      category: "product",
      impactArea: isEn ? "Differentiation, growth" : "Differensiering, vekst",
      rationale: isEn ? `Strong upward trend; early alignment can capture demand.` : `Sterk oppadgående trend; tidlig tilpasning kan fange etterspørsel.`,
      horizon: safeStr(t.strength) === "strong" ? "short" : "medium",
    });
  }

  for (const gap of gaps.slice(0, 5)) {
    innovations.push({
      id: `inn-${idSeq++}`,
      title: isEn ? `Address gap: ${gap.slice(0, 50)}${gap.length > 50 ? "…" : ""}` : `Adresser gap: ${gap.slice(0, 50)}${gap.length > 50 ? "…" : ""}`,
      description: gap,
      category: "product",
      impactArea: isEn ? "Market fit, satisfaction" : "Markedsfit, tilfredshet",
      rationale: isEn ? "Unmet need or white space; innovation can fill gap." : "Udekket behov eller ledig plass; innovasjon kan fylle gapet.",
      horizon: "medium",
    });
  }

  if (strengths.length > 0) {
    innovations.push({
      id: `inn-${idSeq++}`,
      title: isEn ? "Extend strengths into new use cases" : "Utvid styrker til nye bruksområder",
      description: isEn ? `Build on strengths (e.g. ${strengths.slice(0, 2).join(", ")}) to innovate in adjacent areas.` : `Bygg på styrker (f.eks. ${strengths.slice(0, 2).join(", ")}) for å innovere i nærliggende områder.`,
      category: "experience",
      impactArea: isEn ? "Retention, expansion" : "Retensjon, utvidelse",
      rationale: isEn ? "Strengths are a base for differentiated innovation." : "Styrker er grunnlag for differensiert innovasjon.",
      horizon: "medium",
    });
  }

  innovations.push({
    id: `inn-${idSeq++}`,
    title: isEn ? "Process and workflow innovation" : "Prosess- og arbeidsflyt-innovasjon",
    description: isEn ? "Automate or streamline internal or customer-facing processes to reduce friction and cost." : "Automatiser eller strømlinje interne eller kundevendte prosesser for mindre friksjon og kostnad.",
    category: "process",
    impactArea: isEn ? "Efficiency, scalability" : "Effektivitet, skalerbarhet",
    rationale: isEn ? "Process innovation often yields fast ROI and scales well." : "Prosessinnovasjon gir ofte rask ROI og skalerer godt.",
    horizon: "short",
  });

  innovations.push({
    id: `inn-${idSeq++}`,
    title: isEn ? "Experience and journey innovation" : "Opplevelse- og reise-innovasjon",
    description: isEn ? "Redesign key touchpoints (onboarding, support, renewal) for clarity and delight." : "Omdesign sentrale berøringspunkter (onboarding, support, fornyelse) for klarhet og trivelighet.",
    category: "experience",
    impactArea: isEn ? "Satisfaction, NPS" : "Tilfredshet, NPS",
    rationale: isEn ? "Experience innovations improve retention and word-of-mouth." : "Opplevelsesinnovasjon forbedrer retensjon og anbefalinger.",
    horizon: "medium",
  });

  if (goals.some((g) => g.includes("revenue") || g.includes("growth") || g.includes("vekst"))) {
    innovations.push({
      id: `inn-${idSeq++}`,
      title: isEn ? "Business model or pricing innovation" : "Forretningsmodell- eller prisforslag",
      description: isEn ? "Explore packaging, pricing, or monetization models that fit market and strengths." : "Utforsk pakking, prising eller monetiseringsmodeller som passer marked og styrker.",
      category: "business_model",
      impactArea: isEn ? "Revenue, growth" : "Inntekt, vekst",
      rationale: isEn ? "Aligned with growth goal; model innovation can unlock new revenue." : "I tråd med vekstmål; modellinnovasjon kan frigjøre ny inntekt.",
      horizon: "long",
    });
  }

  const summary = isEn
    ? `Innovation suggestions: ${innovations.length} total. Categories: product, process, experience${innovations.some((i) => i.category === "business_model") ? ", business_model" : ""}.`
    : `Innovasjonsforslag: ${innovations.length} totalt. Kategorier: product, process, experience${innovations.some((i) => i.category === "business_model") ? ", business_model" : ""}.`;

  return {
    innovations,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { suggestInnovationsCapability, CAPABILITY_NAME };
