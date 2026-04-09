/**
 * Forslag til innkjøp — aldri auto-gjennomføring; fail-closed ved usikkerhet.
 */

export type PurchaseSuggestionInput = {
  forecastPerDay: number;
  horizonDays: number;
  stock: { onHand: number; leadDays: number; wasteFactor?: number };
  /** Fra forecastUnits; lav verdi skalerer ned forslag (unngå overbestilling). */
  confidence?: number;
  /** Hardt tak (f.eks. catering-kapasitet). */
  maxSuggestedUnits?: number;
};

export type PurchaseSuggestionResult = {
  suggestedUnits: number;
  note: string;
};

export function suggestPurchase({
  forecastPerDay,
  horizonDays,
  stock,
}: {
  forecastPerDay: number;
  horizonDays: number;
  stock: { onHand: number; leadDays: number; wasteFactor?: number };
}): PurchaseSuggestionResult {
  const demand = forecastPerDay * horizonDays;
  const safe = Math.ceil(demand * (1 + (stock.wasteFactor ?? 0.1)));
  const need = Math.max(0, safe - stock.onHand);

  return {
    suggestedUnits: need,
    note: need === 0 ? "Nok på lager" : "Foreslått innkjøp (inkl. svinn-buffer)",
  };
}

/**
 * Samme som {@link suggestPurchase}, med:
 * - nedskalering ved lav konfidens
 * - ekstra demping ved høy wasteFactor (mindre aggressiv bestilling)
 * - valgfritt maks-tak
 */
export function suggestPurchaseCapped(input: PurchaseSuggestionInput): PurchaseSuggestionResult {
  const base = suggestPurchase(input);
  let suggestedUnits = base.suggestedUnits;
  const conf =
    typeof input.confidence === "number" && Number.isFinite(input.confidence)
      ? Math.min(1, Math.max(0, input.confidence))
      : 0.7;
  if (conf < 0.7) {
    const scale = 0.45 + conf * 0.65;
    suggestedUnits = Math.floor(suggestedUnits * scale);
  }
  const wf =
    typeof input.stock.wasteFactor === "number" && Number.isFinite(input.stock.wasteFactor)
      ? Math.min(0.35, Math.max(0, input.stock.wasteFactor))
      : 0.1;
  if (wf > 0.18) {
    suggestedUnits = Math.floor(suggestedUnits * (1 - (wf - 0.18) * 1.2));
  }
  const cap =
    typeof input.maxSuggestedUnits === "number" && Number.isFinite(input.maxSuggestedUnits) && input.maxSuggestedUnits >= 0
      ? Math.floor(input.maxSuggestedUnits)
      : null;
  if (cap !== null) {
    suggestedUnits = Math.min(suggestedUnits, cap);
  }
  suggestedUnits = Math.max(0, suggestedUnits);
  let note = base.note;
  if (suggestedUnits === 0 && base.suggestedUnits > 0) {
    note = "Ikke nok data / lav konfidens — avvent innkjøp (fail-closed).";
  }
  if (cap !== null && suggestedUnits === cap && base.suggestedUnits > cap) {
    note = `${note} (avrundet til maks ${cap} enheter.)`;
  }
  return { suggestedUnits, note };
}
