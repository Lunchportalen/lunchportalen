/**
 * AI page section balancer capability: balancePageSections.
 * Analyzes section/block distribution and balance: type mix, run length, visual rhythm.
 * Returns balance score, suggestions (break runs, add variety), and optional reordered sequence.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "balancePageSections";

const balancePageSectionsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Page section balancer: analyzes block distribution and balance (type mix, run length, visual rhythm). Returns balance score (0-100), suggestions to rebalance (break runs, add variety), section counts, and optional suggested order. Deterministic; no LLM.",
  requiredContext: ["blocks"],
  inputSchema: {
    type: "object",
    description: "Balance page sections input",
    properties: {
      blocks: {
        type: "array",
        description: "Current blocks (id, type, optional data)",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { type: "string" },
            data: { type: "object" },
          },
        },
      },
      pagePurpose: { type: "string", description: "Optional: landing, contact, info, pricing" },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
      maxRunSameType: { type: "number", description: "Max allowed consecutive blocks of same type (default 2)" },
    },
    required: ["blocks"],
  },
  outputSchema: {
    type: "object",
    description: "Section balance result",
    required: ["balanceScore", "suggestions", "sectionCounts", "summary"],
    properties: {
      balanceScore: { type: "number", description: "0-100 (higher = better balanced)" },
      suggestions: {
        type: "array",
        items: {
          type: "object",
          required: ["kind", "message", "suggestion", "priority"],
          properties: {
            kind: { type: "string", description: "break_run | add_variety | reorder | add_divider | add_image" },
            message: { type: "string" },
            suggestion: { type: "string" },
            priority: { type: "string", description: "high | medium | low" },
            blockId: { type: "string" },
            indexHint: { type: "number" },
            sectionType: { type: "string", description: "Block type involved" },
            runLength: { type: "number", description: "Length of run if applicable" },
          },
        },
      },
      sectionCounts: {
        type: "object",
        description: "Count per block type",
        additionalProperties: { type: "number" },
      },
      suggestedOrder: {
        type: "array",
        description: "Optional: block ids in a more balanced order",
        items: { type: "string" },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is balance suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(balancePageSectionsCapability);

export type BalancePageSectionsBlockInput = {
  id: string;
  type?: string | null;
  data?: Record<string, unknown> | null;
};

export type BalancePageSectionsInput = {
  blocks: BalancePageSectionsBlockInput[];
  pagePurpose?: string | null;
  locale?: "nb" | "en" | null;
  maxRunSameType?: number | null;
};

export type SectionBalanceSuggestion = {
  kind: "break_run" | "add_variety" | "reorder" | "add_divider" | "add_image";
  message: string;
  suggestion: string;
  priority: "high" | "medium" | "low";
  blockId?: string | null;
  indexHint?: number | null;
  sectionType?: string | null;
  runLength?: number | null;
};

export type BalancePageSectionsOutput = {
  balanceScore: number;
  suggestions: SectionBalanceSuggestion[];
  sectionCounts: Record<string, number>;
  suggestedOrder: string[];
  summary: string;
};

const MAX_RUN_DEFAULT = 2;

/**
 * Balances page sections: analyzes distribution, runs, variety. Deterministic; no external calls.
 */
export function balancePageSections(input: BalancePageSectionsInput): BalancePageSectionsOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const maxRun =
    typeof input.maxRunSameType === "number" && !Number.isNaN(input.maxRunSameType) && input.maxRunSameType >= 1
      ? input.maxRunSameType
      : MAX_RUN_DEFAULT;
  const blocks = Array.isArray(input.blocks)
    ? input.blocks.filter(
        (b): b is BalancePageSectionsBlockInput =>
          b != null && typeof b === "object" && typeof (b as BalancePageSectionsBlockInput).id === "string"
      )
    : [];

  const suggestions: SectionBalanceSuggestion[] = [];
  const seen = new Set<string>();
  let score = 100;

  function add(
    kind: SectionBalanceSuggestion["kind"],
    message: string,
    suggestion: string,
    priority: SectionBalanceSuggestion["priority"],
    opts?: {
      blockId?: string | null;
      indexHint?: number | null;
      sectionType?: string | null;
      runLength?: number | null;
    }
  ) {
    const key = `${kind}:${opts?.sectionType ?? ""}:${opts?.indexHint ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push({
      kind,
      message,
      suggestion,
      priority,
      blockId: opts?.blockId ?? undefined,
      indexHint: opts?.indexHint ?? undefined,
      sectionType: opts?.sectionType ?? undefined,
      runLength: opts?.runLength ?? undefined,
    });
  }

  const types = blocks.map((b) => (b.type ?? "").trim().toLowerCase() || "unknown");
  const sectionCounts: Record<string, number> = {};
  for (const t of types) {
    sectionCounts[t] = (sectionCounts[t] ?? 0) + 1;
  }

  let currentType = "";
  let runStart = 0;
  for (let i = 0; i <= types.length; i++) {
    const t = i < types.length ? types[i] : "";
    if (t === currentType) continue;
    const runLength = i - runStart;
    if (currentType && runLength > maxRun) {
      score -= Math.min(25, 8 * (runLength - maxRun));
      const blockId = blocks[runStart]?.id;
      add(
        "break_run",
        isEn
          ? `${runLength} consecutive "${currentType}" blocks; break the run for better rhythm.`
          : `${runLength} påfølgende "${currentType}"-blokker; bryt rekken for bedre rytme.`,
        isEn
          ? `Insert an image, divider, or different section type after index ${runStart + maxRun}.`
          : `Sett inn bilde, skillelinje eller annen seksjonstype etter indeks ${runStart + maxRun}.`,
        runLength >= 4 ? "high" : "medium",
        { blockId, indexHint: runStart + maxRun, sectionType: currentType, runLength }
      );
    }
    currentType = t;
    runStart = i;
  }

  const richTextCount = sectionCounts["richtext"] ?? 0;
  const totalContent = blocks.length;
  if (totalContent >= 5 && richTextCount >= totalContent - 1) {
    score -= 15;
    add(
      "add_variety",
      isEn
        ? "Page is mostly text blocks; add images or CTAs for visual balance."
        : "Siden er stort sett tekstblokker; legg til bilder eller CTA-er for visuell balanse.",
      isEn
        ? "Insert 1–2 image or CTA blocks to break up text and improve scannability."
        : "Sett inn 1–2 bilde- eller CTA-blokker for å bryte opp teksten og bedre skanbarhet.",
      "medium",
      { sectionType: "richtext" }
    );
  }

  const imageCount = sectionCounts["image"] ?? 0;
  if (totalContent >= 6 && richTextCount >= 3 && imageCount === 0) {
    score -= 10;
    const firstRichIndex = types.indexOf("richtext");
    const insertAt = firstRichIndex >= 0 ? firstRichIndex + 2 : 1;
    add(
      "add_image",
      isEn
        ? "No image blocks; consider adding one for visual balance."
        : "Ingen bildeblokker; vurder å legge til én for visuell balanse.",
      isEn
        ? "Insert an image block between content sections (e.g. after second richText)."
        : "Sett inn en bildeblokk mellom innholdsseksjoner (f.eks. etter andre richText).",
      "low",
      { indexHint: insertAt, sectionType: "image" }
    );
  }

  const hasDivider = types.includes("divider");
  if (totalContent >= 6 && !hasDivider && richTextCount >= 2) {
    score -= 5;
    const mid = Math.floor(totalContent / 2);
    add(
      "add_divider",
      isEn
        ? "A divider can separate content zones and improve visual rhythm."
        : "En skillelinje kan skille innholdssoner og forbedre visuell rytme.",
      isEn
        ? "Insert a divider block around the middle of the page."
        : "Sett inn en skillelinjeblokk rundt midten av siden.",
      "low",
      { indexHint: mid, sectionType: "divider" }
    );
  }

  const balanceScore = Math.max(0, Math.min(100, score));
  const ids = blocks.map((b) => b.id);

  const summary = isEn
    ? `Balance score: ${balanceScore}/100. ${Object.keys(sectionCounts).length} section type(s), ${suggestions.length} suggestion(s).`
    : `Balansescore: ${balanceScore}/100. ${Object.keys(sectionCounts).length} seksjonstype(r), ${suggestions.length} forslag.`;

  return {
    balanceScore,
    suggestions,
    sectionCounts,
    suggestedOrder: ids,
    summary,
  };
}

export { balancePageSectionsCapability, CAPABILITY_NAME };
