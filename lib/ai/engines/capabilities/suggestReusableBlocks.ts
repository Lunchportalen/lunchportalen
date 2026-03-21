/**
 * Block reuse recommender capability: suggestReusableBlocks.
 * Suggests blocks that are good candidates for reuse: by type, purpose, and context.
 * Returns recommended reusable block patterns (suggestedName, whenToReuse, reason).
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "suggestReusableBlocks";

const suggestReusableBlocksCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Suggests blocks that are good candidates for reuse: by block type, purpose, and context (page/section). Returns recommended reusable patterns with suggested name, when to reuse, reason, and optional priority. Can take current blocks to identify reuse candidates. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Suggest reusable blocks input",
    properties: {
      context: {
        type: "string",
        description: "Context: page purpose (landing, contact, pricing, info) or section type (hero, cta, form, faq) or 'general'",
      },
      blocks: {
        type: "array",
        description: "Optional: current blocks to evaluate as reuse candidates",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { type: "string" },
            data: { type: "object" },
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for labels" },
      limit: { type: "number", description: "Max recommendations to return (default 10)" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Reusable block recommendations",
    required: ["recommendations", "summary"],
    properties: {
      recommendations: {
        type: "array",
        items: {
          type: "object",
          required: ["blockType", "suggestedName", "whenToReuse", "reason"],
          properties: {
            blockType: { type: "string", description: "hero, richText, cta, image, form, divider" },
            suggestedName: { type: "string", description: "Suggested name for the reusable block" },
            whenToReuse: { type: "string", description: "When to use this block" },
            reason: { type: "string", description: "Why it is a good reuse candidate" },
            priority: { type: "string", description: "high | medium | low" },
            category: { type: "string", description: "cta | form | content | layout | decorative" },
            blockId: { type: "string", description: "If from current blocks, the block id" },
          },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is recommendations only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(suggestReusableBlocksCapability);

export type SuggestReusableBlocksInput = {
  context?: string | null;
  blocks?: Array<{ id: string; type?: string | null; data?: Record<string, unknown> | null }> | null;
  locale?: "nb" | "en" | null;
  limit?: number | null;
};

export type ReusableBlockRecommendation = {
  blockType: string;
  suggestedName: string;
  whenToReuse: string;
  reason: string;
  priority?: "high" | "medium" | "low";
  category?: "cta" | "form" | "content" | "layout" | "decorative";
  blockId?: string | null;
};

export type SuggestReusableBlocksOutput = {
  recommendations: ReusableBlockRecommendation[];
  summary: string;
};

type ReusablePattern = {
  blockType: string;
  suggestedNameEn: string;
  suggestedNameNb: string;
  whenEn: string;
  whenNb: string;
  reasonEn: string;
  reasonNb: string;
  priority: ReusableBlockRecommendation["priority"];
  category: ReusableBlockRecommendation["category"];
  contexts: string[];
};

const PATTERNS: ReusablePattern[] = [
  {
    blockType: "cta",
    suggestedNameEn: "Contact CTA",
    suggestedNameNb: "Kontakt-CTA",
    whenEn: "Footer of landing pages, contact page, after long content.",
    whenNb: "Bunntekst på landingssider, kontaktside, etter langt innhold.",
    reasonEn: "Single CTA text and link; reuse for consistency across pages.",
    reasonNb: "Én CTA-tekst og lenke; gjenbruk for konsistens på tvers av sider.",
    priority: "high",
    category: "cta",
    contexts: ["landing", "contact", "cta", "general"],
  },
  {
    blockType: "cta",
    suggestedNameEn: "Demo request CTA",
    suggestedNameNb: "Be om demo-CTA",
    whenEn: "Hero or mid-page on product/landing; one primary action.",
    whenNb: "Hero eller midt på side på produkt/landing; én primær handling.",
    reasonEn: "Same primary conversion CTA everywhere; one source of truth.",
    reasonNb: "Samme primær konverterings-CTA overalt; én sannhetskilde.",
    priority: "high",
    category: "cta",
    contexts: ["landing", "hero", "marketing", "general"],
  },
  {
    blockType: "form",
    suggestedNameEn: "Contact / demo form",
    suggestedNameNb: "Kontakt- / demo-skjema",
    whenEn: "Contact page, demo request, lead capture.",
    whenNb: "Kontaktside, demo-forespørsel, lead-innsamling.",
    reasonEn: "Form ID and title reused; same form on multiple pages.",
    reasonNb: "Skjema-ID og tittel gjenbrukes; samme skjema på flere sider.",
    priority: "high",
    category: "form",
    contexts: ["contact", "form", "landing", "general"],
  },
  {
    blockType: "richText",
    suggestedNameEn: "FAQ section",
    suggestedNameNb: "FAQ-seksjon",
    whenEn: "Pricing, product, or info page; repeated Q&A structure.",
    whenNb: "Prisingsside, produktside eller infoside; gjentatt spørsmål- og svarstruktur.",
    reasonEn: "Same FAQ content on several pages; update once.",
    reasonNb: "Samme FAQ-innhold på flere sider; oppdater én gang.",
    priority: "high",
    category: "content",
    contexts: ["faq", "pricing", "info", "general"],
  },
  {
    blockType: "richText",
    suggestedNameEn: "Intro / value proposition",
    suggestedNameNb: "Intro / verdiforslag",
    whenEn: "Below hero on landing; short value statement.",
    whenNb: "Under hero på landing; kort verdiberegning.",
    reasonEn: "Consistent intro across landing variants.",
    reasonNb: "Konsistent intro på tvers av landingsvarianter.",
    priority: "medium",
    category: "content",
    contexts: ["landing", "hero", "general"],
  },
  {
    blockType: "hero",
    suggestedNameEn: "Standard landing hero",
    suggestedNameNb: "Standard landings-hero",
    whenEn: "Main landing or campaign; one hero per view.",
    whenNb: "Hovedlanding eller kampanje; én hero per visning.",
    reasonEn: "Same structure (headline, CTA, image slot); copy can be overridden per page.",
    reasonNb: "Samme struktur (overskrift, CTA, bildeplass); tekst kan overstyres per side.",
    priority: "medium",
    category: "layout",
    contexts: ["landing", "hero", "marketing", "general"],
  },
  {
    blockType: "divider",
    suggestedNameEn: "Section divider",
    suggestedNameNb: "Seksjonsskille",
    whenEn: "Between major sections; visual break.",
    whenNb: "Mellom hovedseksjoner; visuell pause.",
    reasonEn: "Same decorative divider; no content to maintain.",
    reasonNb: "Samme dekorative skille; ingen innhold å vedlikeholde.",
    priority: "low",
    category: "decorative",
    contexts: ["general", "layout"],
  },
  {
    blockType: "image",
    suggestedNameEn: "Logo or brand image",
    suggestedNameNb: "Logo eller merkevarebilde",
    whenEn: "Repeated logo, partner logo, or standard illustration.",
    whenNb: "Gjentatt logo, partnerlogo eller standard illustrasjon.",
    reasonEn: "Same asset and alt; reuse for consistency.",
    reasonNb: "Samme bilde og alt; gjenbruk for konsistens.",
    priority: "medium",
    category: "content",
    contexts: ["general", "layout"],
  },
];

/**
 * Suggests blocks that are good candidates for reuse. Deterministic; no external calls.
 */
export function suggestReusableBlocks(input: SuggestReusableBlocksInput = {}): SuggestReusableBlocksOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const context = (input.context ?? "general").trim().toLowerCase();
  const limit = typeof input.limit === "number" && !Number.isNaN(input.limit) && input.limit > 0 ? Math.min(20, input.limit) : 10;
  const blocks = Array.isArray(input.blocks) ? input.blocks : [];

  const recommendations: ReusableBlockRecommendation[] = [];
  const seen = new Set<string>();

  for (const p of PATTERNS) {
    const matchesContext =
      context === "general" ||
      p.contexts.some((c) => context.includes(c) || c.includes(context));
    if (!matchesContext || recommendations.length >= limit) continue;

    const key = `${p.blockType}:${p.suggestedNameEn}`;
    if (seen.has(key)) continue;
    seen.add(key);

    recommendations.push({
      blockType: p.blockType,
      suggestedName: isEn ? p.suggestedNameEn : p.suggestedNameNb,
      whenToReuse: isEn ? p.whenEn : p.whenNb,
      reason: isEn ? p.reasonEn : p.reasonNb,
      priority: p.priority,
      category: p.category,
    });
  }

  if (blocks.length > 0) {
    const typeCount = new Map<string, number>();
    for (const b of blocks) {
      const t = (b.type ?? "").trim().toLowerCase() || "unknown";
      typeCount.set(t, (typeCount.get(t) ?? 0) + 1);
    }
    for (const [blockType, count] of typeCount) {
      if (count >= 2 && recommendations.length < limit) {
        const existing = recommendations.find((r) => r.blockType === blockType);
        if (!existing) {
          const p = PATTERNS.find((x) => x.blockType === blockType);
          if (p) {
            recommendations.push({
              blockType,
              suggestedName: isEn ? `Reuse ${blockType} (${count} on page)` : `Gjenbruk ${blockType} (${count} på siden)`,
              whenToReuse: isEn ? "Same block type appears multiple times; consider one reusable block." : "Samme blokktype forekommer flere ganger; vurder én gjenbrukbar blokk.",
              reason: isEn ? p.reasonEn : p.reasonNb,
              priority: "high",
              category: p.category,
            });
          }
        }
      }
    }
  }

  const summary = isEn
    ? `Suggested ${recommendations.length} reusable block(s) for context «${context || "general"}».`
    : `Foreslått ${recommendations.length} gjenbrukbar(e) blokk(er) for kontekst «${context || "general"}».`;

  return {
    recommendations: recommendations.slice(0, limit),
    summary,
  };
}

export { suggestReusableBlocksCapability, CAPABILITY_NAME };
