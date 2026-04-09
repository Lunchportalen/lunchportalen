export type ReplySentiment = "positive" | "negative" | "neutral";

/**
 * Deterministic keyword scan (Norwegian-first). Not a substitute for human review.
 */
export function detectCloseSignal(text: string): ReplySentiment {
  const t = text.toLowerCase();
  if (t.includes("ikke aktuelt") || t.includes("avslå") || t.includes("unsubscribe")) {
    return "negative";
  }
  if (t.includes("ja") || t.includes("interessert") || t.includes("møte") || t.includes("demo")) {
    return "positive";
  }
  return "neutral";
}

/** Statisk avslutningstekst (GTM-flyt) — ikke blandet med signal-deteksjon. */
export function generateClosingMessage(_deal: { id?: string }): string {
  void _deal;
  return `Vi kan starte opp allerede neste uken.

Skal vi sette opp avtale?`;
}
