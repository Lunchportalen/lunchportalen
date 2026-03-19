/**
 * Screenshot improvement AI capability: suggestLayoutFix.
 * Suggests layout fixes from a screenshot context: layout description and/or current blocks.
 * Returns layout score, actionable fixes (add hero/CTA, break runs, alignment, spacing), and optional suggested block order.
 * Deterministic; no LLM. Aligns with 1-3-1 and conversion flow.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "suggestLayoutFix";

const suggestLayoutFixCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Screenshot improvement AI: suggests layout fixes from a layout description and/or current blocks. Returns layout score (0-100), fixes (add hero/CTA, break runs, alignment, spacing, hierarchy), and optional suggested block types/order. Use for screenshot-based improvement. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Suggest layout fix input",
    properties: {
      layoutDescription: {
        type: "string",
        description: "Text describing the screenshot/layout (e.g. 'hero at top, then 3 text blocks, no CTA')",
      },
      screenshotUrl: { type: "string", description: "Optional screenshot URL (for contract; not processed in deterministic path)" },
      blocks: {
        type: "array",
        description: "Optional current blocks (id, type) to suggest fixes for",
        items: {
          type: "object",
          properties: { id: { type: "string" }, type: { type: "string" }, data: { type: "object" } },
        },
      },
      focus: {
        type: "string",
        description: "Optional: conversion | readability | mobile | hierarchy (hints which fixes to emphasize)",
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
      maxBlocks: { type: "number", description: "Max blocks to suggest (default 10)" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Layout fix suggestions",
    required: ["layoutScore", "fixes", "summary"],
    properties: {
      layoutScore: { type: "number", description: "0-100 (higher = better layout)" },
      fixes: {
        type: "array",
        items: {
          type: "object",
          required: ["kind", "message", "suggestion", "priority"],
          properties: {
            kind: {
              type: "string",
              description: "add_hero | add_cta | add_divider | break_run | reorder | alignment | spacing | hierarchy | contrast",
            },
            message: { type: "string" },
            suggestion: { type: "string" },
            priority: { type: "string", description: "high | medium | low" },
            blockId: { type: "string" },
            indexHint: { type: "number" },
            action: { type: "string", description: "insert_block | move_block | reorder | adjust_style" },
          },
        },
      },
      suggestedBlockTypes: {
        type: "array",
        description: "Recommended block type sequence",
        items: { type: "string" },
      },
      summary: { type: "string" },
      warnings: { type: "array", items: { type: "string" } },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is improvement suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(suggestLayoutFixCapability);

export type SuggestLayoutFixInput = {
  layoutDescription?: string | null;
  screenshotUrl?: string | null;
  blocks?: Array<{ id?: string | null; type?: string | null; data?: Record<string, unknown> | null }> | null;
  focus?: "conversion" | "readability" | "mobile" | "hierarchy" | string | null;
  locale?: "nb" | "en" | null;
  maxBlocks?: number | null;
};

export type LayoutFixKind =
  | "add_hero"
  | "add_cta"
  | "add_divider"
  | "break_run"
  | "reorder"
  | "alignment"
  | "spacing"
  | "hierarchy"
  | "contrast";

export type LayoutFix = {
  kind: LayoutFixKind;
  message: string;
  suggestion: string;
  priority: "high" | "medium" | "low";
  blockId?: string | null;
  indexHint?: number | null;
  action?: "insert_block" | "move_block" | "reorder" | "adjust_style" | null;
};

export type SuggestLayoutFixOutput = {
  layoutScore: number;
  fixes: LayoutFix[];
  suggestedBlockTypes: string[];
  summary: string;
  warnings?: string[] | null;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Infer block type sequence from layout description (keyword-based). */
function inferBlockTypesFromDescription(description: string): string[] {
  const d = description.toLowerCase().trim();
  if (!d) return ["hero", "richText", "cta"];
  const types: string[] = [];
  if (/\bhero\b|hovedseksjon|toppbilde|banner|headline\s*section/i.test(d)) types.push("hero");
  if (/\b(?:text|tekst|rich\s*text|section|seksjon|paragraph|avsnitt|content|innhold)(?:\s*\d*)?\b/i.test(d)) {
    const m = d.match(/(\d+)\s*(?:text|tekst|section|seksjon|paragraph|avsnitt|block|blokk)/i) || d.match(/several\s+text|flere\s+tekst/i);
    const n = m ? Math.min(parseInt(m[1], 10) || 1, 5) : 1;
    for (let i = 0; i < n; i++) types.push("richText");
  }
  if (/\bimage\b|bilde|picture|photo\s*block/i.test(d)) types.push("image");
  if (/\bdivider\b|skille|separator|linje/i.test(d)) types.push("divider");
  if (/\bcta\b|call\s*to\s*action|knapp|button\s*section|kontakt\s*blokk/i.test(d)) types.push("cta");
  if (types.length === 0) return ["hero", "richText", "cta"];
  if (!types.includes("hero")) types.unshift("hero");
  if (!types.includes("cta")) types.push("cta");
  return types.slice(0, 10);
}

/**
 * Screenshot improvement: suggests layout fixes from description and/or blocks. Deterministic; no external calls.
 */
export function suggestLayoutFix(input: SuggestLayoutFixInput = {}): SuggestLayoutFixOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const layoutDescription = str(input.layoutDescription);
  const blocks = Array.isArray(input.blocks)
    ? input.blocks.filter(
        (b): b is { id?: string | null; type?: string | null; data?: Record<string, unknown> | null } =>
          b != null && typeof b === "object"
      )
    : [];
  const focus = str(input.focus).toLowerCase();
  const maxBlocks = Math.min(20, Math.max(1, Math.floor(Number(input.maxBlocks) ?? 10)));
  const warnings: string[] = [];

  const fixes: LayoutFix[] = [];
  const seen = new Set<string>();
  let score = 100;

  function add(
    kind: LayoutFixKind,
    message: string,
    suggestion: string,
    priority: LayoutFix["priority"],
    opts?: { blockId?: string | null; indexHint?: number | null; action?: LayoutFix["action"] }
  ) {
    const key = `${kind}:${opts?.blockId ?? ""}:${opts?.indexHint ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    fixes.push({
      kind,
      message,
      suggestion,
      priority,
      blockId: opts?.blockId ?? undefined,
      indexHint: opts?.indexHint ?? undefined,
      action: opts?.action ?? undefined,
    });
  }

  const types = blocks.length > 0
    ? blocks.map((b) => (b.type ?? "").trim().toLowerCase()).filter(Boolean)
    : inferBlockTypesFromDescription(layoutDescription);
  const hasHero = types.includes("hero");
  const hasCta = types.includes("cta");
  const heroIndex = types.indexOf("hero");
  const ctaIndex = types.indexOf("cta");
  const lastIndex = types.length - 1;

  if (!hasHero) {
    score -= 25;
    add(
      "add_hero",
      isEn ? "Layout has no hero; first impression may be weak." : "Layoutet har ingen hero; første inntrykk kan være svakt.",
      isEn ? "Add a hero block at the top (headline, subtitle, primary CTA)." : "Legg til en hero-blokk øverst (overskrift, undertekst, primær CTA).",
      "high",
      { indexHint: 0, action: "insert_block" }
    );
  } else if (heroIndex !== 0) {
    score -= 15;
    const blockId = blocks[heroIndex] && "id" in blocks[heroIndex] ? String((blocks[heroIndex] as { id?: unknown }).id) : undefined;
    add(
      "reorder",
      isEn ? "Hero is not first; move it to the top." : "Hero er ikke først; flytt den øverst.",
      isEn ? "Move hero block to index 0." : "Flytt hero-blokk til indeks 0.",
      "high",
      { blockId: blockId ?? undefined, indexHint: 0, action: "move_block" }
    );
  }

  if (!hasCta) {
    score -= 20;
    add(
      "add_cta",
      isEn ? "Layout has no CTA; users lack a clear next step." : "Layoutet har ingen CTA; brukere mangler et tydelig neste steg.",
      isEn ? "Add a CTA block near the end (e.g. Contact, Request demo)." : "Legg til en CTA-blokk nær slutten (f.eks. Kontakt, Be om demo).",
      "high",
      { indexHint: Math.max(0, lastIndex), action: "insert_block" }
    );
  } else if (ctaIndex >= 0 && ctaIndex < lastIndex - 1) {
    score -= 10;
    const blockId = blocks[ctaIndex] && "id" in blocks[ctaIndex] ? String((blocks[ctaIndex] as { id?: unknown }).id) : undefined;
    add(
      "reorder",
      isEn ? "CTA is not near the end; consider moving it later." : "CTA er ikke nær slutten; vurder å flytte den lenger ned.",
      isEn ? "Move CTA block to the last or second-to-last position." : "Flytt CTA-blokk til siste eller nest siste posisjon.",
      "medium",
      { blockId: blockId ?? undefined, indexHint: lastIndex, action: "move_block" }
    );
  }

  let richTextRun = 0;
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    if (t === "richtext" || t === "richText") richTextRun += 1;
    else richTextRun = 0;
    if (richTextRun >= 3) {
      score -= 10;
      const blockId = blocks[i] && "id" in blocks[i] ? String((blocks[i] as { id?: unknown }).id) : undefined;
      add(
        "break_run",
        isEn ? "Three or more text blocks in a row; break with image or divider." : "Tre eller flere tekstblokker på rad; bryt med bilde eller skillelinje.",
        isEn ? "Insert an image or divider block between long text sections." : "Sett inn en bilde- eller skillelinjeblokk mellom lange tekstseksjoner.",
        "medium",
        { blockId: blockId ?? undefined, indexHint: i, action: "insert_block" }
      );
      break;
    }
  }

  const hasDivider = types.includes("divider");
  if (types.length >= 4 && !hasDivider && hasHero && hasCta) {
    score -= 5;
    const mid = Math.floor(types.length / 2);
    add(
      "add_divider",
      isEn ? "A divider between content and CTA can improve visual hierarchy." : "En skillelinje mellom innhold og CTA kan forbedre visuelt hierarki.",
      isEn ? "Insert a divider block before the CTA section." : "Sett inn en skillelinjeblokk før CTA-seksjonen.",
      "low",
      { indexHint: mid, action: "insert_block" }
    );
  }

  const desc = layoutDescription.toLowerCase();
  if (desc && (/\bcrowded\b|tett|cluttered|rotet|squeezed|presset/i.test(desc))) {
    score -= 10;
    add(
      "spacing",
      isEn ? "Layout may feel crowded; increase spacing between sections." : "Layoutet kan virke tett; øk avstand mellom seksjoner.",
      isEn ? "Use consistent vertical rhythm (e.g. 2–3rem between sections)." : "Bruk konsekvent vertikal rytme (f.eks. 2–3rem mellom seksjoner).",
      focus === "readability" ? "high" : "medium",
      { action: "adjust_style" }
    );
  }
  if (desc && (/\bmisalign|juster|alignment|justering|off\s*center|skjev/i.test(desc))) {
    score -= 10;
    add(
      "alignment",
      isEn ? "Alignment issues detected; center or align content consistently." : "Justeringsproblemer oppdaget; sentrer eller juster innhold konsekvent.",
      isEn ? "Use a single max-width container and consistent horizontal alignment." : "Bruk én maksbredde-container og konsekvent horisontal justering.",
      "medium",
      { action: "adjust_style" }
    );
  }
  if (desc && (/\bno\s*contrast|lav\s*kontrast|hard\s*to\s*read|vanskelig\s*å\s*lese|faint|utydelig/i.test(desc))) {
    score -= 15;
    add(
      "contrast",
      isEn ? "Contrast may be low; improve text/background contrast for readability." : "Kontrasten kan være lav; forbedre tekst/bakgrunnskontrast for lesbarhet.",
      isEn ? "Ensure sufficient contrast (WCAG AA) and avoid low-contrast text." : "Sikre tilstrekkelig kontrast (WCAG AA) og unngå lavkontrast tekst.",
      focus === "readability" ? "high" : "medium",
      { action: "adjust_style" }
    );
  }
  if (desc && (/\bno\s*hierarchy|flat|flatt|everything\s*same|alt\s*samme\s*størrelse/i.test(desc))) {
    score -= 10;
    add(
      "hierarchy",
      isEn ? "Visual hierarchy may be flat; emphasize headline and primary CTA." : "Visuelt hierarki kan være flatt; fremhev overskrift og primær CTA.",
      isEn ? "Use one clear H1, one primary CTA (hot-pink accent), and calm body text." : "Bruk én tydelig H1, én primær CTA (hot-pink accent) og rolig brødtekst.",
      focus === "hierarchy" ? "high" : "medium",
      { action: "adjust_style" }
    );
  }
  if (desc && (/\bmobile|small\s*screen|overflow|scroll\s*horizontal|horisontal\s*scroll/i.test(desc))) {
    score -= 10;
    add(
      "spacing",
      isEn ? "Mobile layout may have overflow or cramped spacing." : "Mobil-layout kan ha overflow eller tett spacing.",
      isEn ? "Ensure full-width content, no horizontal scroll, and touch targets ≥ 44px." : "Sikre fullbredde-innhold, ingen horisontal scroll og touch-mål ≥ 44px.",
      focus === "mobile" ? "high" : "medium",
      { action: "adjust_style" }
    );
  }

  const layoutScore = Math.max(0, Math.min(100, score));

  const suggestedBlockTypes: string[] = [];
  if (heroIndex >= 0 && heroIndex !== 0) {
    const hero = types[heroIndex];
    const rest = types.filter((_, i) => i !== heroIndex);
    suggestedBlockTypes.push(hero!, ...rest);
  } else {
    suggestedBlockTypes.push(...types);
  }
  if (!suggestedBlockTypes.includes("cta")) suggestedBlockTypes.push("cta");
  const trimmed = suggestedBlockTypes.slice(0, maxBlocks);

  if (input.screenshotUrl && !layoutDescription) {
    warnings.push(
      isEn ? "screenshotUrl provided but no layoutDescription; fixes based on inferred or current blocks." : "screenshotUrl angitt uten layoutDescription; forbedringer basert på inferert eller nåværende blokker."
    );
  }

  const summary = isEn
    ? `Layout score: ${layoutScore}/100. ${fixes.length} fix(es) suggested. ${fixes.length === 0 ? "Layout looks good." : "Apply fixes for better conversion and clarity."}`
    : `Layoutscore: ${layoutScore}/100. ${fixes.length} forbedring(er) foreslått. ${fixes.length === 0 ? "Layoutet ser bra ut." : "Bruk forbedringene for bedre konvertering og tydelighet."}`;

  return {
    layoutScore,
    fixes,
    suggestedBlockTypes: trimmed,
    summary,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export { suggestLayoutFixCapability, CAPABILITY_NAME };
