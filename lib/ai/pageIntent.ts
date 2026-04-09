/**
 * Heuristic page intent from a free-form prompt (no ML).
 * Drives deterministic layout rules + explainability copy.
 */

import { getLayoutForIntent } from "./layoutRules";

export type PageIntentGoal = "sell" | "inform" | "landing" | "product";

export type PageIntent = {
  goal: PageIntentGoal;
  audience: string;
  tone: string;
  sections: string[];
  keywords?: string[];
};

const GOAL_KEYWORDS: Array<{ re: RegExp; goal: PageIntentGoal }> = [
  { re: /\b(landing|landingside|kampanje)\b/i, goal: "landing" },
  { re: /\b(product|produkt|pris|pakke|abonnement)\b/i, goal: "product" },
  { re: /\b(salg|selg|konverter|cta|bestill|kjøp)\b/i, goal: "sell" },
  { re: /\b(guide|veiledning|informasjon|lære|faq|hjelp|om oss)\b/i, goal: "inform" },
];

const TONE_HINTS: Array<{ re: RegExp; tone: string }> = [
  { re: /\b(formell|enterprise|b2b)\b/i, tone: "formell og tydelig" },
  { re: /\b(varm|vennlig|personlig)\b/i, tone: "varm og profesjonell" },
  { re: /\b(kort|konkret|direkte)\b/i, tone: "kort og konkret" },
];

function firstLine(prompt: string): string {
  return prompt.trim().split("\n")[0]?.trim() ?? "";
}

/**
 * Parse structured intent using keyword heuristics over Norwegian/English cues.
 */
export function parseIntent(prompt: string): PageIntent {
  const p = String(prompt ?? "").trim();
  const lower = p.toLowerCase();
  let goal: PageIntentGoal = "inform";
  for (const { re, goal: g } of GOAL_KEYWORDS) {
    if (re.test(lower)) {
      goal = g;
      break;
    }
  }

  let tone = "rolig og profesjonell";
  for (const { re, tone: t } of TONE_HINTS) {
    if (re.test(lower)) {
      tone = t;
      break;
    }
  }

  const keywords: string[] = [];
  const kwMatch = lower.match(/\b(catering|lunsj|kantine|trondheim|oslo|bergen|b2b|hr|kontor)\b/g);
  if (kwMatch) keywords.push(...Array.from(new Set(kwMatch)));

  const audience =
    p.match(/for\s+([^.\n]+)/i)?.[1]?.trim()?.slice(0, 120) ||
    firstLine(p).slice(0, 120) ||
    "besøkende på siden";

  const sections: string[] = [];
  if (/\blanding\b/i.test(lower)) sections.push("landing");
  if (/\bprodukt\b/i.test(lower)) sections.push("product");
  if (/\bguide\b/i.test(lower) || /\bfaq\b/i.test(lower)) sections.push("informasjon");

  return {
    goal,
    audience,
    tone,
    sections: sections.length ? sections : [goal],
    keywords: keywords.length ? keywords : undefined,
  };
}

/** User-visible explanation after generation (trust / audit). */
export function explainGeneration(intent: PageIntent, layoutLabels: readonly string[]): string {
  const goalNb: Record<PageIntentGoal, string> = {
    landing: "landingside",
    product: "produktside",
    sell: "salgsside",
    inform: "informasjonsside",
  };
  const g = goalNb[intent.goal];
  const parts = [
    `Denne siden er satt opp som en ${g} for «${intent.audience}»`,
    `med tone: ${intent.tone}.`,
  ];
  if (layoutLabels.length) {
    parts.push(`Struktur (seksjoner): ${layoutLabels.join(" → ")}.`);
  }
  if (intent.keywords?.length) {
    parts.push(`Nøkkelord som ble plukket opp: ${intent.keywords.join(", ")}.`);
  }
  return parts.join(" ");
}

/**
 * Augments the user prompt so `/api/ai/layout` respects intent-derived structure hints.
 */
export function buildLayoutPromptWithIntent(userPrompt: string): string {
  const intent = parseIntent(userPrompt);
  const layout = getLayoutForIntent(intent);
  return [
    "Oppgave: Lag blokker for Lunchportalen-CMS (typer: hero, richText, image, cta).",
    `Sidehensikt: ${intent.goal}`,
    `Målgruppe: ${intent.audience}`,
    `Tone: ${intent.tone}`,
    `Foreslått seksjonsrekkefølge (mappes til blokker): ${layout.join(" → ")}.`,
    intent.keywords?.length ? `Nøkkelord: ${intent.keywords.join(", ")}` : "",
    "",
    "Brukerbeskrivelse:",
    userPrompt.trim(),
  ]
    .filter((x) => x !== "")
    .join("\n");
}
