/**
 * Deterministic NL-style queries over {@link SystemIntelligence} (explainable, no LLM).
 */

import type { SystemIntelligence } from "./types";

export type IntelligenceQueryAnswer = {
  question: string;
  answer: string;
  basedOn: string[];
  confidence: "high" | "medium" | "low";
};

function pushUnique(arr: string[], v: string) {
  if (!arr.includes(v)) arr.push(v);
}

/**
 * Answer common intelligence questions from the shared read-model.
 */
export function answerIntelligenceQuestion(question: string, intel: SystemIntelligence): IntelligenceQueryAnswer {
  const q = String(question ?? "").toLowerCase().trim();
  const basedOn: string[] = [];
  const { signals, trends, learningHistory, recentEvents, meta } = intel;

  const worksBest =
    /what works best|hva fungerer|beste kanal|beste bransje|best practice|hva virker/i.test(q);
  const failedRecently =
    /failed|feilet|dårlig|fallende|svikt|anomal|problem|negative|nedgang/i.test(q);

  if (worksBest) {
    pushUnique(basedOn, "signals.topCTA");
    pushUnique(basedOn, "signals.bestChannel");
    pushUnique(basedOn, "signals.bestIndustry");
    pushUnique(basedOn, "signals.bestSpacing");
    const answer = [
      `Sterkest målt CTA-fokus: ${signals.topCTA}.`,
      `Beste kanal (etter GTM-aggregat): ${signals.bestChannel}.`,
      `Sterkest bransje (etter GTM-aggregat): ${signals.bestIndustry}.`,
      `Anbefalt spacing-etikett fra designhendelser: ${signals.bestSpacing}.`,
    ].join(" ");
    return { question, answer, basedOn, confidence: signals.bestChannel === "insufficient_data" ? "low" : "medium" };
  }

  if (failedRecently) {
    pushUnique(basedOn, "trends.fallingPerformance");
    pushUnique(basedOn, "trends.anomalies");
    pushUnique(basedOn, "recentEvents");
    const parts: string[] = [];
    if (trends.fallingPerformance) parts.push("Systemet ser tegn til fallende ytelse (konvertering og/eller revenue-innsikt).");
    if (trends.anomalies.length) parts.push(`Anomalier: ${trends.anomalies.join("; ")}.`);
    if (trends.explain.length) parts.push(trends.explain.slice(0, 3).join(" "));
    const weakAnalytics = recentEvents.filter((e) => e.type === "analytics" && e.payload.sampleOk === false).length;
    if (weakAnalytics > 0) parts.push(`${weakAnalytics} analytics-hendelse(r) med sampleOk=false i nylig vindu.`);
    if (parts.length === 0) parts.push("Ingen eksplisitte «feilet nylig»-flagg i trendmodellen — se hendelseslogg for detaljer.");
    return { question, answer: parts.join(" "), basedOn, confidence: trends.anomalies.length ? "medium" : "low" };
  }

  if (/learning|læring|endring|resultat/i.test(q)) {
    pushUnique(basedOn, "learningHistory");
    if (learningHistory.length === 0) {
      return {
        question,
        answer: "Ingen registrerte læringspar (change → result) i dette vinduet.",
        basedOn,
        confidence: "low",
      };
    }
    const top = learningHistory.slice(0, 5);
    return {
      question,
      answer: top.map((h) => `${h.change} → ${h.result}`).join(" | "),
      basedOn,
      confidence: "medium",
    };
  }

  pushUnique(basedOn, "meta.eventCounts");
  const ec = meta?.eventCounts ?? {};
  return {
    question,
    answer: `Sammendrag: ${Object.entries(ec)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ")} hendelser i valgt vindu. Spør f.eks. «hva fungerer best?» eller «hva feilet nylig?».`,
    basedOn,
    confidence: "low",
  };
}
