/**
 * Feature suggestion engine capability: suggestProductFeatures.
 * Suggests product features from user feedback, competitive gaps, goals, and current product context.
 * Returns prioritized suggestions with category, rationale, and impact hint. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "suggestProductFeatures";

const suggestProductFeaturesCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Suggests product features from user feedback, competitive gaps, product goals, and current feature set. Returns prioritized suggestions with category, rationale, and impact hint. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Feature suggestion input",
    properties: {
      productContext: {
        type: "object",
        description: "Current product context",
        properties: {
          productName: { type: "string" },
          currentFeatures: { type: "array", items: { type: "string" } },
        },
      },
      userFeedback: {
        type: "array",
        description: "Themes or requests from users",
        items: {
          type: "object",
          properties: {
            theme: { type: "string" },
            count: { type: "number", description: "Mentions or votes" },
            sentiment: { type: "string", enum: ["positive", "neutral", "negative", "request"] },
          },
        },
      },
      competitiveGaps: {
        type: "array",
        description: "Features competitors have that we lack",
        items: { type: "string" },
      },
      goals: {
        type: "array",
        description: "Product goals (e.g. retention, conversion, efficiency)",
        items: { type: "string" },
      },
      locale: { type: "string", enum: ["nb", "en"] },
    },
  },
  outputSchema: {
    type: "object",
    description: "Feature suggestion result",
    required: ["suggestions", "summary", "generatedAt"],
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "title", "description", "category", "priority", "rationale", "impactHint"],
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            category: { type: "string", enum: ["usability", "automation", "reporting", "integration", "compliance", "other"] },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            rationale: { type: "string" },
            impactHint: { type: "string" },
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
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(suggestProductFeaturesCapability);

const CATEGORIES = ["usability", "automation", "reporting", "integration", "compliance", "other"] as const;

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

function mapThemeToCategory(theme: string): (typeof CATEGORIES)[number] {
  const t = theme.toLowerCase();
  if (/report|dashboard|export|analytics|insight/.test(t)) return "reporting";
  if (/auto|schedule|workflow|remind|notif/.test(t)) return "automation";
  if (/integrate|api|sync|import|export/.test(t)) return "integration";
  if (/compliance|audit|security|gdpr/.test(t)) return "compliance";
  if (/easy|simple|ux|mobile|speed|search/.test(t)) return "usability";
  return "other";
}

export type ProductContextInput = {
  productName?: string | null;
  currentFeatures?: string[] | null;
};

export type UserFeedbackInput = {
  theme?: string | null;
  count?: number | null;
  sentiment?: string | null;
};

export type SuggestProductFeaturesInput = {
  productContext?: ProductContextInput | null;
  userFeedback?: UserFeedbackInput[] | null;
  competitiveGaps?: string[] | null;
  goals?: string[] | null;
  locale?: "nb" | "en" | null;
};

export type FeatureSuggestion = {
  id: string;
  title: string;
  description: string;
  category: (typeof CATEGORIES)[number];
  priority: "high" | "medium" | "low";
  rationale: string;
  impactHint: string;
};

export type SuggestProductFeaturesOutput = {
  suggestions: FeatureSuggestion[];
  summary: string;
  generatedAt: string;
};

/**
 * Suggests product features from feedback, gaps, and goals. Deterministic; no external calls.
 */
export function suggestProductFeatures(input: SuggestProductFeaturesInput): SuggestProductFeaturesOutput {
  const isEn = input.locale === "en";
  const product = input.productContext && typeof input.productContext === "object" ? input.productContext : {};
  const currentFeatures = Array.isArray(product.currentFeatures) ? product.currentFeatures.map(safeStr) : [];
  const feedback = Array.isArray(input.userFeedback) ? input.userFeedback.filter((f) => f && typeof f === "object") : [];
  const gaps = Array.isArray(input.competitiveGaps) ? input.competitiveGaps.map(safeStr).filter(Boolean) : [];
  const goals = Array.isArray(input.goals) ? input.goals.map(safeStr).filter(Boolean) : [];

  const suggestions: FeatureSuggestion[] = [];
  let idSeq = 1;

  for (const f of feedback) {
    const theme = safeStr(f.theme);
    if (!theme) continue;
    const count = typeof f.count === "number" && f.count > 0 ? f.count : 1;
    const sentiment = safeStr(f.sentiment);

    const category = mapThemeToCategory(theme);
    const priority = count >= 5 || sentiment === "request" ? "high" : count >= 2 ? "medium" : "low";
    const title = theme.length > 50 ? theme.slice(0, 47) + "…" : theme;
    const rationale = isEn
      ? `User feedback: ${theme} (${count} mention(s)).`
      : `Brukertilbakemelding: ${theme} (${count} nevning(er)).`;
    const impactHint = isEn
      ? "Addresses user-requested need; may improve satisfaction and retention."
      : "Adresserer brukerønsket behov; kan forbedre tilfredshet og retensjon.";

    suggestions.push({
      id: `feat-${idSeq++}`,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      description: theme,
      category,
      priority,
      rationale,
      impactHint,
    });
  }

  for (const gap of gaps) {
    if (!gap || suggestions.some((s) => s.description.toLowerCase() === gap)) continue;
    const category = mapThemeToCategory(gap);
    const priority = goals.some((g) => g.includes("compet") || g.includes("different")) ? "high" : "medium";
    const rationale = isEn ? `Competitive gap: competitors offer similar; consider for parity or differentiation.` : `Konkurransemessig gap: konkurrenter tilbyr tilsvarende; vurder for paritet eller differensiering.`;
    const impactHint = isEn ? "Reduces competitive disadvantage; supports win/loss narrative." : "Reduserer konkurranseulempe; støtter win/loss-narrativ.";

    suggestions.push({
      id: `feat-${idSeq++}`,
      title: gap.charAt(0).toUpperCase() + gap.slice(1),
      description: gap,
      category,
      priority,
      rationale,
      impactHint,
    });
  }

  if (goals.some((g) => g.includes("efficiency") || g.includes("effektiv"))) {
    const hasAutomation = suggestions.some((s) => s.category === "automation");
    if (!hasAutomation) {
      suggestions.push({
        id: `feat-${idSeq++}`,
        title: isEn ? "Automation and workflows" : "Automatisering og arbeidsflyt",
        description: isEn ? "Reduce manual steps; automate repeat tasks." : "Reduser manuelle steg; automatiser gjentakende oppgaver.",
        category: "automation",
        priority: "medium",
        rationale: isEn ? "Aligned with efficiency goal." : "I tråd med effektivitetsmål.",
        impactHint: isEn ? "Saves time; scales operations." : "Sparer tid; skalerer operasjoner.",
      });
    }
  }

  if (goals.some((g) => g.includes("retention") || g.includes("tilfreds"))) {
    const hasUsability = suggestions.some((s) => s.category === "usability");
    if (!hasUsability) {
      suggestions.push({
        id: `feat-${idSeq++}`,
        title: isEn ? "Usability and onboarding improvements" : "Brukeropplevelse og onboarding",
        description: isEn ? "Improve ease of use and first-time experience." : "Forbedre brukervennlighet og første gangs opplevelse.",
        category: "usability",
        priority: "medium",
        rationale: isEn ? "Aligned with retention goal." : "I tråd med retensjonsmål.",
        impactHint: isEn ? "Lower friction; higher stickiness." : "Mindre friksjon; bedre vedvarende bruk.",
      });
    }
  }

  suggestions.sort((a, b) => {
    const pOrder = { high: 0, medium: 1, low: 2 };
    return pOrder[a.priority] - pOrder[b.priority];
  });

  const summary = isEn
    ? `Feature suggestions: ${suggestions.length} total. ${suggestions.filter((s) => s.priority === "high").length} high priority.`
    : `Funksjonsforslag: ${suggestions.length} totalt. ${suggestions.filter((s) => s.priority === "high").length} høy prioritet.`;

  return {
    suggestions,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { suggestProductFeaturesCapability, CAPABILITY_NAME };
