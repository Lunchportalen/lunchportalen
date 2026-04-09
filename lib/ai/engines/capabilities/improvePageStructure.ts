/**
 * AI page improvement engine capability: improvePageStructure.
 * Analyzes page structure (title, blocks) and returns a structure score, actionable
 * improvements (layout, order, missing sections), and optional suggested block order.
 * Deterministic; no LLM. Aligns with 1-3-1 and conversion flow.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "improvePageStructure";

const improvePageStructureCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Page improvement engine: analyzes page structure (title, blocks) and returns structure score (0-100), actionable improvements (add hero/CTA, reorder, break long runs), and suggested block order. Uses page purpose and locale. Deterministic; no LLM.",
  requiredContext: ["page"],
  inputSchema: {
    type: "object",
    description: "Improve page structure input",
    properties: {
      page: {
        type: "object",
        description: "Page to improve (title, blocks)",
        properties: {
          title: { type: "string" },
          blocks: {
            type: "array",
            description: "Blocks (id, type, data)",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                type: { type: "string" },
                data: { type: "object" },
              },
            },
          },
        },
      },
      pagePurpose: { type: "string", description: "Optional: landing, contact, info, pricing" },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["page"],
  },
  outputSchema: {
    type: "object",
    description: "Page structure improvement result",
    required: ["structureScore", "improvements", "summary"],
    properties: {
      structureScore: { type: "number", description: "0-100 (higher = better structure)" },
      improvements: {
        type: "array",
        items: {
          type: "object",
          required: ["kind", "message", "suggestion", "priority"],
          properties: {
            kind: { type: "string", description: "add_hero | add_cta | reorder | move_block | break_run | add_divider | title_length" },
            message: { type: "string" },
            suggestion: { type: "string" },
            priority: { type: "string", description: "high | medium | low" },
            blockId: { type: "string" },
            indexHint: { type: "number" },
            action: { type: "string", description: "Suggested action for patch: insert_block | move_block | reorder" },
          },
        },
      },
      suggestedOrder: {
        type: "array",
        description: "Recommended block ids in display order",
        items: { type: "string" },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is improvement suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(improvePageStructureCapability);

export type ImprovePageStructurePageInput = {
  title?: string | null;
  blocks?: Array<{ id: string; type?: string | null; data?: Record<string, unknown> | null }> | null;
};

export type ImprovePageStructureInput = {
  page: ImprovePageStructurePageInput;
  pagePurpose?: string | null;
  locale?: "nb" | "en" | null;
};

export type PageStructureImprovement = {
  kind: "add_hero" | "add_cta" | "reorder" | "move_block" | "break_run" | "add_divider" | "title_length";
  message: string;
  suggestion: string;
  priority: "high" | "medium" | "low";
  blockId?: string | null;
  indexHint?: number | null;
  action?: "insert_block" | "move_block" | "reorder" | null;
};

export type ImprovePageStructureOutput = {
  structureScore: number;
  improvements: PageStructureImprovement[];
  suggestedOrder: string[];
  summary: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Page improvement engine: analyzes structure and returns score, improvements, suggested order. Deterministic; no external calls.
 */
export function improvePageStructure(input: ImprovePageStructureInput): ImprovePageStructureOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const page = input.page && typeof input.page === "object" ? input.page : { title: "", blocks: [] };
  const blocks = Array.isArray(page.blocks)
    ? page.blocks.filter(
        (b): b is { id: string; type?: string | null; data?: Record<string, unknown> | null } =>
          b != null && typeof b === "object" && typeof (b as { id?: unknown }).id === "string"
      )
    : [];
  const title = str(page.title);

  const improvements: PageStructureImprovement[] = [];
  const seen = new Set<string>();
  let score = 100;

  function add(
    kind: PageStructureImprovement["kind"],
    message: string,
    suggestion: string,
    priority: PageStructureImprovement["priority"],
    opts?: { blockId?: string | null; indexHint?: number | null; action?: PageStructureImprovement["action"] }
  ) {
    const key = `${kind}:${opts?.blockId ?? ""}:${opts?.indexHint ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    improvements.push({
      kind,
      message,
      suggestion,
      priority,
      blockId: opts?.blockId ?? undefined,
      indexHint: opts?.indexHint ?? undefined,
      action: opts?.action ?? undefined,
    });
  }

  const types = blocks.map((b) => (b.type ?? "").trim().toLowerCase());
  const ids = blocks.map((b) => b.id);
  const hasHero = types.includes("hero");
  const hasCta = types.includes("cta");
  const heroIndex = types.indexOf("hero");
  const ctaIndex = types.indexOf("cta");
  const lastIndex = blocks.length - 1;

  if (!hasHero) {
    score -= 25;
    add(
      "add_hero",
      isEn ? "Page has no hero; first impression may be weak." : "Siden har ingen hero; første inntrykk kan være svakt.",
      isEn ? "Insert a hero block at index 0 (headline, subtitle, primary CTA)." : "Sett inn en hero-blokk på indeks 0 (overskrift, undertekst, primær CTA).",
      "high",
      { indexHint: 0, action: "insert_block" }
    );
  } else if (heroIndex !== 0) {
    score -= 15;
    const heroId = blocks[heroIndex]?.id;
    add(
      "reorder",
      isEn ? "Hero is not first; move it to the top for clarity." : "Hero er ikke først; flytt den øverst for tydelighet.",
      isEn ? "Move hero block to index 0 (suggestedOrder reflects this)." : "Flytt hero-blokk til indeks 0 (suggestedOrder reflekterer dette).",
      "high",
      { blockId: heroId ?? undefined, indexHint: 0, action: "move_block" }
    );
  }

  if (!hasCta) {
    score -= 20;
    add(
      "add_cta",
      isEn ? "Page has no CTA; users lack a clear next step." : "Siden har ingen CTA; brukere mangler et tydelig neste steg.",
      isEn ? "Add a CTA block near the end (e.g. Contact, Request demo)." : "Legg til en CTA-blokk nær slutten (f.eks. Kontakt, Be om demo).",
      "high",
      { indexHint: Math.max(0, lastIndex), action: "insert_block" }
    );
  } else if (ctaIndex >= 0 && ctaIndex < lastIndex - 1) {
    score -= 10;
    const ctaId = blocks[ctaIndex]?.id;
    add(
      "move_block",
      isEn ? "CTA is not near the end; consider moving it later." : "CTA er ikke nær slutten; vurder å flytte den lenger ned.",
      isEn ? "Move CTA block to the last or second-to-last position." : "Flytt CTA-blokk til siste eller nest siste posisjon.",
      "medium",
      { blockId: ctaId ?? undefined, indexHint: lastIndex, action: "move_block" }
    );
  }

  let richTextRun = 0;
  for (let i = 0; i < types.length; i++) {
    if (types[i] === "richtext") richTextRun += 1;
    else richTextRun = 0;
    if (richTextRun >= 3) {
      score -= 10;
      add(
        "break_run",
        isEn ? "Three or more text blocks in a row; consider breaking with image or divider." : "Tre eller flere tekstblokker på rad; vurder å bryte med bilde eller skillelinje.",
        isEn ? "Insert an image or divider block between long text sections." : "Sett inn en bilde- eller skillelinjeblokk mellom lange tekstseksjoner.",
        "medium",
        { blockId: blocks[i]?.id, indexHint: i, action: "insert_block" }
      );
      break;
    }
  }

  const hasDivider = types.includes("divider");
  if (blocks.length >= 4 && !hasDivider && hasHero && hasCta) {
    score -= 5;
    const mid = Math.floor(blocks.length / 2);
    add(
      "add_divider",
      isEn ? "A divider between content and CTA can improve visual hierarchy." : "En skillelinje mellom innhold og CTA kan forbedre visuelt hierarki.",
      isEn ? "Insert a divider block before the CTA section." : "Sett inn en skillelinjeblokk før CTA-seksjonen.",
      "low",
      { indexHint: mid, action: "insert_block" }
    );
  }

  if (title.length > 80) {
    score -= 5;
    add(
      "title_length",
      isEn ? "Page title is long; consider shortening for clarity and SEO." : "Sidetittel er lang; vurder å forkorte for tydelighet og SEO.",
      isEn ? "Keep title under 60–70 characters where possible." : "Hold tittelen under 60–70 tegn der det er mulig.",
      "low"
    );
  } else if (blocks.length > 0 && !title) {
    score -= 5;
    add(
      "title_length",
      isEn ? "Page has no title; add one for context and SEO." : "Siden har ingen tittel; legg til en for kontekst og SEO.",
      isEn ? "Set a short, descriptive page title." : "Sett en kort, beskrivende sidetittel.",
      "medium"
    );
  }

  const structureScore = Math.max(0, Math.min(100, score));

  const suggestedOrder: string[] = [];
  if (heroIndex >= 0 && heroIndex !== 0) {
    const heroId = blocks[heroIndex]!.id;
    const rest = ids.filter((id) => id !== heroId);
    suggestedOrder.push(heroId, ...rest);
  } else {
    suggestedOrder.push(...ids);
  }

  const summary = isEn
    ? `Structure score: ${structureScore}/100. ${improvements.length} improvement(s). ${improvements.length === 0 ? "Structure looks good." : "Apply improvements for better flow."}`
    : `Strukturscore: ${structureScore}/100. ${improvements.length} forbedring(er). ${improvements.length === 0 ? "Strukturen ser bra ut." : "Bruk forbedringene for bedre flyt."}`;

  return {
    structureScore,
    improvements,
    suggestedOrder,
    summary,
  };
}

export { improvePageStructureCapability, CAPABILITY_NAME };
