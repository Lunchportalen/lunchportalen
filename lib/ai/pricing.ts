/**
 * Prisrådgiver — kun forslag. Aldri auto-apply eller skjulte endringer.
 */

export type DemandSignal = "high" | "low" | "neutral";

export type PricingSuggestion = {
  action: "increase" | "decrease" | "hold";
  suggestion: number | null;
  reason: string;
  riskNote: string;
};

export function suggestPricing(currentPrice: number, demandSignal: DemandSignal): PricingSuggestion | null {
  const p = Number(currentPrice);
  if (!Number.isFinite(p) || p <= 0) {
    return {
      action: "hold",
      suggestion: null,
      reason: "Ugyldig nåværende pris — sett et positivt tall for analyse.",
      riskNote: "Ingen beregning utført.",
    };
  }

  if (demandSignal === "high") {
    return {
      action: "increase",
      suggestion: Math.round(p * 1.1 * 100) / 100,
      reason: "Signal: høy etterspørsel — teoretisk rom for forsiktig prisøkning (10 % eksempel).",
      riskNote: "Må godkjennes av økonomi/salg; sjekk kontrakter, rabatter og konkurranse før endring.",
    };
  }

  if (demandSignal === "low") {
    return {
      action: "decrease",
      suggestion: Math.round(p * 0.9 * 100) / 100,
      reason: "Signal: lav etterspørsel — vurder kampanje eller lavere listepris (10 % eksempel).",
      riskNote: "Priskutt kan påvirke margin og merkevare; simuler volumbehov før beslutning.",
    };
  }

  return null;
}

/** Standard chat-modell når env / konfig mangler eller economy-tier. */
export const FALLBACK_CHAT_MODEL_ID = "gpt-4o-mini";

/** Konservativ øvre kostnadsgrense (USD) for én chat-completion — brukt av lønnsomhetslås. */
export function estimateMaxUsdChatCompletion(_params: {
  modelId: string;
  promptChars: number;
  maxCompletionTokens: number;
}): number {
  return 0.01;
}

export function estimateMaxUsdDalle3Standard1024(): number {
  return 0.04;
}

export function estimateMaxUsdOpenAiImagesPassthrough(): number {
  return 0.02;
}

export function estimateUsdForTokens(
  _promptTokens: number,
  _completionTokens: number,
  _modelId?: string,
): number {
  return 0.005;
}

export function resolveConfiguredOpenAiChatModelId(configured?: string | null): string {
  const s = typeof configured === "string" ? configured.trim() : "";
  return s || FALLBACK_CHAT_MODEL_ID;
}

/** Legacy: brukes av lønnsomhetsmotor for nedgradering — deterministisk tillatt. */
export function isGpt4oClassDowngradable(_modelId: string): boolean {
  return true;
}
