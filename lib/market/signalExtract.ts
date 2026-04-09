/**
 * Strukturerte signaler fra tekst — ingen rå kopiering av konkurrentinnhold (kun målbare trekk).
 * Ren logikk, trygg for import fra klient/server.
 */

export type MarketPostLike = { text: string };

export type ExtractedSignals = {
  length: number;
  hasEmoji: boolean;
  hasCTA: boolean;
  emotionalWords: number;
  format: "story" | "short" | "hybrid";
};

const EMOTIONAL_LEXICON_NO = ["perfekt", "eksklusiv", "håndverk", "premium", "ekte"] as const;

export function countEmotionalWords(text: string): number {
  const t = String(text ?? "").toLowerCase();
  return EMOTIONAL_LEXICON_NO.filter((w) => t.includes(w)).length;
}

export function detectFormat(text: string): ExtractedSignals["format"] {
  const s = String(text ?? "");
  const lines = s.split("\n").length;
  if (lines > 4) return "story";
  if (s.length < 120) return "short";
  return "hybrid";
}

export function extractSignals(post: MarketPostLike): ExtractedSignals {
  const text = String(post?.text ?? "");
  const lower = text.toLowerCase();
  const hasCTA = text.includes("→") || lower.includes("book") || lower.includes("demo");
  return {
    length: text.length,
    hasEmoji: /[\u{1F300}-\u{1F6FF}]/u.test(text),
    hasCTA,
    emotionalWords: countEmotionalWords(text),
    format: detectFormat(text),
  };
}
