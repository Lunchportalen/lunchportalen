/**
 * Forsiktige prisforslag (±5–10 %) — policy begrenser videre.
 * Krever kjent nåpris; ellers fail-closed (tom liste).
 */

import type { BusinessState } from "@/lib/ai/businessStateEngine";

export type PricingSuggestion = {
  targetLabel: string;
  deltaPercent: number;
  reason: string;
  dataUsed: string[];
};

export type PricingEngineOutput = {
  suggestions: PricingSuggestion[];
  transparency: string[];
};

export function buildSafePricingSuggestions(opts: {
  currentPriceExVat: number | null;
  forecastConfidence: number;
  hindcastAbsError: number | null;
  maxDeltaPercent: number;
}): PricingEngineOutput {
  const transparency = [
    `Justeringer begrenses til ±${opts.maxDeltaPercent} % i policy — aldri automatisk i produksjon.`,
    "Kontrakt og avtalevilkår må alltid sjekkes manuelt før endring.",
  ];

  const p = opts.currentPriceExVat;
  if (p == null || !(p > 0)) {
    return { suggestions: [], transparency: [...transparency, "Ingen registrert grunnpris — ingen prisforslag (fail-safe)."] };
  }

  const suggestions: PricingSuggestion[] = [];
  const err = opts.hindcastAbsError ?? 0;
  const cap = Math.min(10, Math.max(5, opts.maxDeltaPercent));

  if (err >= 4 && opts.forecastConfidence >= 0.4) {
    const d = Math.min(cap, 8);
    suggestions.push({
      targetLabel: "Standard porsjon (eks. mva)",
      deltaPercent: d,
      reason: "Hindcast viste betydelig høyere faktisk volum enn modell — forsiktig oppjustering.",
      dataUsed: ["hindcast error", "demand confidence"],
    });
  } else if (err <= 1 && opts.forecastConfidence >= 0.5) {
    const d = -Math.min(cap, 5);
    suggestions.push({
      targetLabel: "Standard porsjon (eks. mva)",
      deltaPercent: d,
      reason: "Stabil etterspørsel — liten nedjustering kan øke konkurransekraft (sjekk kontrakt).",
      dataUsed: ["hindcast error", "demand confidence"],
    });
  }

  return { suggestions, transparency };
}

/** God mode / cron: enkle pris-signaler ut fra konvertering (deterministisk). */
export type GodModePricingSignal = { type: "INCREASE_PRICE" } | { type: "DECREASE_PRICE" };

export function suggestPricing(state: BusinessState): GodModePricingSignal[] {
  const out: GodModePricingSignal[] = [];
  if (state.conversion >= 0.05) out.push({ type: "INCREASE_PRICE" });
  if (state.conversion <= 0.02) out.push({ type: "DECREASE_PRICE" });
  return out;
}
