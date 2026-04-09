/**
 * AI CTA hierarchy generator capability: suggestCTAHierarchy.
 * Suggests a clear CTA hierarchy: primary, secondary, and tertiary CTAs with labels and placement.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "suggestCTAHierarchy";

const suggestCTAHierarchyCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Suggests a CTA hierarchy: one primary CTA, optional secondary and tertiary CTAs, with recommended labels, placement (hero, mid, footer), and order. Uses conversion goal and optional context.",
  requiredContext: ["conversionGoal"],
  inputSchema: {
    type: "object",
    description: "Suggest CTA hierarchy input",
    properties: {
      conversionGoal: {
        type: "string",
        description: "Primary conversion (e.g. signup, lead, purchase, book)",
      },
      context: {
        type: "string",
        description: "Optional: page or funnel context (e.g. landing, product, pricing)",
      },
      maxSecondary: { type: "number", description: "Max secondary CTAs (default 2)" },
      maxTertiary: { type: "number", description: "Max tertiary CTAs (default 2)" },
      locale: { type: "string", description: "Locale (nb | en) for labels" },
    },
    required: ["conversionGoal"],
  },
  outputSchema: {
    type: "object",
    description: "CTA hierarchy",
    required: ["primary", "secondary", "tertiary", "rules", "summary"],
    properties: {
      primary: {
        type: "object",
        required: ["label", "placement", "action", "order"],
        properties: {
          label: { type: "string" },
          placement: { type: "string", description: "hero | mid | footer" },
          action: { type: "string", description: "convert | contact | learn_more" },
          order: { type: "number" },
          description: { type: "string" },
        },
      },
      secondary: {
        type: "array",
        items: {
          type: "object",
          required: ["label", "placement", "action", "order"],
          properties: {
            label: { type: "string" },
            placement: { type: "string" },
            action: { type: "string" },
            order: { type: "number" },
            description: { type: "string" },
          },
        },
      },
      tertiary: {
        type: "array",
        items: {
          type: "object",
          required: ["label", "placement", "action", "order"],
          properties: {
            label: { type: "string" },
            placement: { type: "string" },
            action: { type: "string" },
            order: { type: "number" },
            description: { type: "string" },
          },
        },
      },
      rules: { type: "array", items: { type: "string" }, description: "Hierarchy rules (e.g. one primary only)" },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(suggestCTAHierarchyCapability);

export type SuggestCTAHierarchyInput = {
  conversionGoal: string;
  context?: string | null;
  maxSecondary?: number | null;
  maxTertiary?: number | null;
  locale?: "nb" | "en" | null;
};

export type CTAItem = {
  label: string;
  placement: "hero" | "mid" | "footer";
  action: "convert" | "contact" | "learn_more" | "secondary_action";
  order: number;
  description?: string;
};

export type SuggestCTAHierarchyOutput = {
  primary: CTAItem;
  secondary: CTAItem[];
  tertiary: CTAItem[];
  rules: string[];
  summary: string;
};

function goalToPrimaryLabel(goal: string, isEn: boolean): string {
  const g = goal.toLowerCase();
  if (/lead|henvendelse|kontakt|demo|prøv/.test(g)) return isEn ? "Contact us" : "Kontakt oss";
  if (/purchase|buy|kjøp|order/.test(g)) return isEn ? "Add to cart" : "Legg i handlekurv";
  if (/signup|registrer|abonner|subscribe/.test(g)) return isEn ? "Get started" : "Kom i gang";
  if (/book|bestill|reserv|bord/.test(g)) return isEn ? "Book now" : "Bestill nå";
  return isEn ? "Continue" : "Fortsett";
}

/**
 * Suggests CTA hierarchy: one primary, optional secondary and tertiary, with placement and rules.
 * Deterministic; no external calls.
 */
export function suggestCTAHierarchy(input: SuggestCTAHierarchyInput): SuggestCTAHierarchyOutput {
  const isEn = input.locale === "en";
  const goal = (input.conversionGoal ?? "").trim() || (isEn ? "signup" : "registrering");
  const maxSecondary = Math.min(4, Math.max(0, Math.floor(Number(input.maxSecondary) ?? 2)));
  const maxTertiary = Math.min(4, Math.max(0, Math.floor(Number(input.maxTertiary) ?? 2)));

  const primaryLabel = goalToPrimaryLabel(goal, isEn);
  const primary: CTAItem = {
    label: primaryLabel,
    placement: "hero",
    action: "convert",
    order: 1,
    description: isEn ? "Single main action; repeat in hero and before footer." : "Én hovedhandling; gjenta i hero og før footer.",
  };

  const secondary: CTAItem[] = [];
  secondary.push({
    label: isEn ? "Learn more" : "Les mer",
    placement: "mid",
    action: "learn_more",
    order: 1,
    description: isEn ? "Soften for users not ready to convert." : "Mykere for brukere som ikke er klare.",
  });
  if (maxSecondary >= 2) {
    secondary.push({
      label: isEn ? "Contact sales" : "Kontakt salg",
      placement: "mid",
      action: "contact",
      order: 2,
      description: isEn ? "Alternative for high-consideration users." : "Alternativ for brukere som vurderer.",
    });
  }

  const tertiary: CTAItem[] = [];
  if (maxTertiary >= 1) {
    tertiary.push({
      label: isEn ? "View pricing" : "Se priser",
      placement: "footer",
      action: "secondary_action",
      order: 1,
      description: isEn ? "Low emphasis in footer." : "Lav vekt i footer.",
    });
  }
  if (maxTertiary >= 2) {
    tertiary.push({
      label: isEn ? "Back to top" : "Til toppen",
      placement: "footer",
      action: "secondary_action",
      order: 2,
      description: isEn ? "Utility only." : "Kun hjelp.",
    });
  }

  const rules: string[] = [
    isEn ? "One primary CTA only; same label everywhere." : "Én primær CTA; samme label overalt.",
    isEn ? "Primary: hero and once more before footer." : "Primær: hero og én gang før footer.",
    isEn ? "Secondary: text or outline style; never compete with primary." : "Sekundær: tekst eller outline; konkurrer aldri med primær.",
    isEn ? "Tertiary: footer or low-visibility; minimal emphasis." : "Tertiær: footer eller lav synlighet; minimal vekt.",
  ];

  const summary = isEn
    ? `CTA hierarchy: primary "${primaryLabel}" (hero + pre-footer), ${secondary.length} secondary, ${tertiary.length} tertiary. One primary rule.`
    : `CTA-hierarki: primær «${primaryLabel}» (hero + pre-footer), ${secondary.length} sekundære, ${tertiary.length} tertiære. Én primær-regel.`;

  return {
    primary,
    secondary: secondary.slice(0, maxSecondary),
    tertiary: tertiary.slice(0, maxTertiary),
    rules,
    summary,
  };
}

export { suggestCTAHierarchyCapability, CAPABILITY_NAME };
