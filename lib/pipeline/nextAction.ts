/**
 * Neste anbefalte handling per trinn (deterministisk).
 */

export type DealNextActionInput = {
  stage?: unknown;
  age_days?: unknown;
};

function safeStage(v: unknown): string {
  return typeof v === "string" && v.length > 0 ? v : "lead";
}

function safeNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function getNextAction(deal: DealNextActionInput | null | undefined): string {
  const d = deal ?? {};
  const stage = safeStage(d.stage);
  const age = safeNum(d.age_days ?? 0);

  if (stage === "lead") {
    return "Ta første kontakt";
  }

  if (stage === "qualified") {
    return "Book møte";
  }

  if (stage === "proposal") {
    return age > 3 ? "Følg opp tilbud" : "Vent på respons";
  }

  if (stage === "negotiation") {
    return "Lukk deal / avklar beslutning";
  }

  if (stage === "won") {
    return "Onboard kunde";
  }

  if (stage === "lost") {
    return "Analyser tap";
  }

  return "Ingen anbefaling";
}
