import "server-only";

import { calculateSignificance } from "@/lib/experiments/stats";
import type { ExperimentResults, VariantResultRow } from "@/lib/experiments/types";

/** Minimum views per variant required before statistical comparison. */
export const MIN_VIEWS_STATISTICAL = 100;

export type StatisticalWinnerResult = {
  winnerVariantId: string | null;
  confidence: number;
  reason: string;
  pValue: number;
  significant: boolean;
  compared: { variantA: string; variantB: string; rateA: number; rateB: number } | null;
  editorPrep: {
    headline: string;
    subline: string;
    applyLabel: string;
    confidencePct: string;
  };
};

/**
 * Pick a winner only when sample sizes and two-proportion z-test support it.
 */
export function selectWinner(results: ExperimentResults, confidence: number = 0.95): StatisticalWinnerResult {
  const variants = [...results.variants].filter((v) => v.views >= MIN_VIEWS_STATISTICAL);
  if (variants.length < 2) {
    return {
      winnerVariantId: null,
      confidence,
      reason: `Trenger minst to varianter med ≥${MIN_VIEWS_STATISTICAL} visninger hver (per nå: ${variants.length} kvalifisert).`,
      pValue: 1,
      significant: false,
      compared: null,
      editorPrep: {
        headline: "Ikke nok data",
        subline: "Samle mer trafikk før statistisk vinner velges.",
        applyLabel: "Ikke tilgjengelig",
        confidencePct: `${Math.round(confidence * 100)}%`,
      },
    };
  }

  variants.sort((a, b) => b.conversionRate - a.conversionRate || b.views - a.views);
  const a = variants[0]!;
  const b = variants[1]!;

  const sig = calculateSignificance(a.conversions, a.views, b.conversions, b.views, confidence);

  const compared = {
    variantA: a.variantId,
    variantB: b.variantId,
    rateA: a.conversionRate,
    rateB: b.conversionRate,
  };

  if (!sig.significant) {
    return {
      winnerVariantId: null,
      confidence,
      reason: `Ingen signifikant forskjell (p≈${sig.pValue.toFixed(4)} ≥ ${(1 - confidence).toFixed(3)}). Toppvarianter: ${a.variantId} vs ${b.variantId}.`,
      pValue: sig.pValue,
      significant: false,
      compared,
      editorPrep: {
        headline: "Ingen signifikant vinner",
        subline: `Sammenligning ${a.variantId} vs ${b.variantId}. Øk sample eller vent lenger.`,
        applyLabel: "Manuell vurdering",
        confidencePct: `${Math.round(confidence * 100)}%`,
      },
    };
  }

  if (a.conversionRate <= b.conversionRate) {
    return {
      winnerVariantId: null,
      confidence,
      reason: "Signifikans funnet, men høyere rate er ikke entydig toppvariant (sjekk data).",
      pValue: sig.pValue,
      significant: true,
      compared,
      editorPrep: {
        headline: "Uvanlig utfall",
        subline: "Manuell gjennomgang anbefales.",
        applyLabel: "Åpne i editor",
        confidencePct: `${Math.round(confidence * 100)}%`,
      },
    };
  }

  return {
    winnerVariantId: a.variantId,
    confidence,
    reason: `Signifikant bedre konvertering for «${a.variantId}» vs «${b.variantId}» (p≈${sig.pValue.toFixed(4)}, z≈${sig.z.toFixed(3)}).`,
    pValue: sig.pValue,
    significant: true,
    compared,
    editorPrep: {
      headline: "Statistisk vinner funnet",
      subline: `Variant ${a.variantId} slår ${b.variantId} ved ${Math.round(confidence * 100)}% konfidensnivå.`,
        applyLabel: "Lim inn i CMS (preview) manuelt",
      confidencePct: `${Math.round(confidence * 100)}%`,
    },
  };
}
