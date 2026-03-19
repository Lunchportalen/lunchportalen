/**
 * AI Waste Reduction capability: suggestMenuChangesForWaste.
 * AI analyserer: hva som ikke blir spist, hva som ofte avbestilles, hva som blir igjen –
 * og foreslår menyendringer. Deterministic; no LLM.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "wasteReduction";

const wasteReductionCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Waste reduction: analyzes what is not eaten, often cancelled, or left over; suggests menu changes to reduce waste. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Waste reduction input",
    properties: {
      dishStats: {
        type: "array",
        description: "Per-dish: ordered, uneaten, cancelled, leftover",
        items: {
          type: "object",
          properties: {
            dishId: { type: "string" },
            title: { type: "string" },
            orderedCount: { type: "number" },
            uneatenCount: { type: "number", description: "Not eaten by customer" },
            cancelledCount: { type: "number" },
            leftoverCount: { type: "number", description: "Left over after service" },
          },
        },
      },
      periodLabel: { type: "string" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["dishStats"],
  },
  outputSchema: {
    type: "object",
    description: "Waste reduction output",
    required: ["suggestions", "summary", "generatedAt"],
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["reduce_portions", "swap_or_remove", "smaller_batches", "improve_timing"] },
            dishId: { type: "string" },
            dishTitle: { type: "string" },
            rationale: { type: "string" },
            impactHint: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "suggestion_only",
      description: "Output is menu change suggestions only; no system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api", "kitchen"],
};

registerCapability(wasteReductionCapability);

export type DishWasteStats = {
  dishId?: string | null;
  title?: string | null;
  orderedCount: number;
  uneatenCount?: number | null;
  cancelledCount?: number | null;
  leftoverCount?: number | null;
};

export type WasteReductionInput = {
  dishStats: DishWasteStats[];
  periodLabel?: string | null;
  locale?: "nb" | "en" | null;
};

export type MenuChangeSuggestion = {
  type: "reduce_portions" | "swap_or_remove" | "smaller_batches" | "improve_timing";
  dishId: string | null;
  dishTitle: string;
  rationale: string;
  impactHint: string;
};

export type WasteReductionOutput = {
  suggestions: MenuChangeSuggestion[];
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

/**
 * Suggests menu changes to reduce waste from uneaten, cancelled, and leftover data. Deterministic.
 */
export function suggestMenuChangesForWaste(input: WasteReductionInput): WasteReductionOutput {
  const isEn = input.locale === "en";
  const stats = Array.isArray(input.dishStats) ? input.dishStats : [];
  const periodLabel = safeStr(input.periodLabel) || (isEn ? "the period" : "perioden");

  const suggestions: MenuChangeSuggestion[] = [];

  for (const d of stats) {
    const title = safeStr(d.title || d.dishId) || "unknown";
    const dishId = safeStr(d.dishId) || null;
    if (title === "unknown") continue;

    const ordered = safeNum(d.orderedCount);
    const uneaten = safeNum(d.uneatenCount);
    const cancelled = safeNum(d.cancelledCount);
    const leftover = safeNum(d.leftoverCount);

    if (ordered <= 0) continue;

    const uneatenRate = ordered > 0 ? uneaten / ordered : 0;
    const cancelRate = ordered > 0 ? cancelled / ordered : 0;
    const leftoverRate = ordered > 0 ? leftover / ordered : 0;

    if (uneatenRate >= 0.15) {
      suggestions.push({
        type: "reduce_portions",
        dishId,
        dishTitle: title,
        rationale: isEn
          ? `High uneaten rate (${Math.round(uneatenRate * 100)}%); many portions not finished.`
          : `Høy andel som ikke spises (${Math.round(uneatenRate * 100)} %); mange porsjoner ikke fullført.`,
        impactHint: isEn
          ? "Consider smaller portions or half-portion option."
          : "Vurder mindre porsjoner eller halvporsjon.",
      });
    }

    if (cancelRate >= 0.2) {
      suggestions.push({
        type: "swap_or_remove",
        dishId,
        dishTitle: title,
        rationale: isEn
          ? `Often cancelled (${Math.round(cancelRate * 100)}%); may be unpopular or poorly timed.`
          : `Ofte avbestilt (${Math.round(cancelRate * 100)} %); kan være lite populær eller dårlig timet.`,
        impactHint: isEn
          ? "Consider replacing with a more popular dish or moving to another day."
          : "Vurder å bytte ut med mer populær rett eller flytte til annen dag.",
      });
    }

    if (leftoverRate >= 0.15) {
      suggestions.push({
        type: "smaller_batches",
        dishId,
        dishTitle: title,
        rationale: isEn
          ? `Frequent leftover (${Math.round(leftoverRate * 100)}%); production often exceeds demand.`
          : `Mye blir igjen (${Math.round(leftoverRate * 100)} %); produksjon overstiger ofte etterspørselen.`,
        impactHint: isEn
          ? "Prepare smaller batches or use demand forecast to align production."
          : "Lag mindre batch eller bruk etterspørselsprognose for å tilpasse produksjon.",
      });
    }

    const hasTimingForDish = suggestions.some((s) => s.dishTitle === title && s.type === "improve_timing");
    if (!hasTimingForDish && (cancelRate >= 0.12 || leftoverRate >= 0.12)) {
      suggestions.push({
        type: "improve_timing",
        dishId,
        dishTitle: title,
        rationale: isEn
          ? "Cancellations or leftover suggest order window or preparation timing could be improved."
          : "Avbestillinger eller rester tyder på at bestillingsfrist eller tilberedningstid kan forbedres.",
        impactHint: isEn
          ? "Shorten order window or align prep time with delivery slot."
          : "Forkort bestillingsfrist eller tilpass tilberedning til leveringsvindu.",
      });
    }
  }

  const deduped = suggestions.filter(
    (s, i) => suggestions.findIndex((x) => x.dishTitle === s.dishTitle && x.type === s.type) === i
  );

  const summary =
    deduped.length > 0
      ? isEn
        ? `${deduped.length} menu change suggestion(s) for ${periodLabel} to reduce waste.`
        : `${deduped.length} menyendringsforslag for ${periodLabel} for å redusere matsvinn.`
      : isEn
        ? "No strong waste signals; current menu alignment is reasonable for the period."
        : "Ingen tydelige matsvinnsignaler; menyen er rimelig tilpasset perioden.";

  return {
    suggestions: deduped,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
