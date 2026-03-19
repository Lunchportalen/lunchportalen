/**
 * Page intent detector capability: detectPageIntent.
 * Analyserer hva en side faktisk prøver å oppnå: informere, selge, rekruttere, bygge tillit.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectPageIntent";

const detectPageIntentCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Detects what a page is trying to achieve: inform, sell, recruit, build trust. Uses page title, block types, and optional text. Returns primary intent, confidence, and summary. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Detect page intent input",
    properties: {
      page: {
        type: "object",
        description: "Page to analyze",
        properties: {
          title: { type: "string" },
          description: { type: "string", description: "Meta or short description" },
          blocks: {
            type: "array",
            description: "Block types or snippets for signal",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                data: { type: "object", description: "Optional title/body excerpt" },
              },
            },
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for labels" },
    },
    required: ["page"],
  },
  outputSchema: {
    type: "object",
    description: "Page intent result",
    required: ["primaryIntent", "confidence", "label", "summary", "detectedAt"],
    properties: {
      primaryIntent: {
        type: "string",
        enum: ["inform", "sell", "recruit", "trust"],
        description: "What the page is trying to achieve",
      },
      confidence: { type: "number", description: "0-1" },
      label: { type: "string" },
      summary: { type: "string" },
      detectedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is detection only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(detectPageIntentCapability);

export type PageIntentType = "inform" | "sell" | "recruit" | "trust";

export type DetectPageIntentPageInput = {
  title?: string | null;
  description?: string | null;
  blocks?: Array<{ type?: string | null; data?: Record<string, unknown> | null }> | null;
};

export type DetectPageIntentInput = {
  page: DetectPageIntentPageInput;
  locale?: "nb" | "en" | null;
};

export type DetectPageIntentOutput = {
  primaryIntent: PageIntentType;
  confidence: number;
  label: string;
  summary: string;
  detectedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

function score(text: string, patterns: RegExp[]): number {
  if (!text) return 0;
  let hits = 0;
  for (const p of patterns) {
    if (p.test(text)) hits++;
  }
  return hits > 0 ? Math.min(1, 0.4 + hits * 0.2) : 0;
}

const INFORM_PATTERNS = [
  /\b(om oss|about|informasjon|information|guide|veiledning|hva|what|hvordan|how|faq|spørsmål|questions)\b/i,
  /\b(artikkel|article|blogg|blog|les mer|read more|lær|læring|learning)\b/i,
];

const SELL_PATTERNS = [
  /\b(kjøp|buy|bestill|order|tilbud|offer|pris|price|produkt|product|demo|bestill nå|order now)\b/i,
  /\b(kontakt oss|contact|få tilbud|get quote|registrer|sign up|start gratis|free trial)\b/i,
];

const RECRUIT_PATTERNS = [
  /\b(jobb|job|karriere|career|rekrutter|recruit|ledige stillinger|vacancies|vi ansetter|we're hiring)\b/i,
  /\b(arbeidsplass|workplace|ansatt|employee|søk stilling|apply)\b/i,
];

const TRUST_PATTERNS = [
  /\b(tillit|trust|anmeldelse|review|testimonial|kunde|customer|sertifisert|certified|garanti|guarantee)\b/i,
  /\b(referanse|reference|case|casestudy|sikkerhet|security|personvern|privacy)\b/i,
];

/**
 * Detects page intent from title, description, and block signals. Deterministic; no external calls.
 */
export function detectPageIntent(input: DetectPageIntentInput): DetectPageIntentOutput {
  const isEn = input.locale === "en";
  const page = input.page && typeof input.page === "object" ? input.page : {};
  const title = safeStr(page.title ?? "");
  const desc = safeStr(page.description ?? "");
  const blocks = Array.isArray(page.blocks) ? page.blocks : [];
  let combined = `${title} ${desc}`;
  for (const b of blocks) {
    if (b && typeof b === "object" && b.data && typeof b.data === "object") {
      const d = b.data as Record<string, unknown>;
      const t = safeStr(d.title ?? d.headline ?? d.body ?? "");
      if (t) combined += " " + t;
    }
    const type = safeStr((b as { type?: unknown }).type ?? "");
    if (type) combined += " " + type;
  }

  const scores: Record<PageIntentType, number> = {
    inform: score(combined, INFORM_PATTERNS),
    sell: score(combined, SELL_PATTERNS),
    recruit: score(combined, RECRUIT_PATTERNS),
    trust: score(combined, TRUST_PATTERNS),
  };

  const ranked = (Object.entries(scores) as [PageIntentType, number][])
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);

  const primaryIntent: PageIntentType = ranked.length > 0 ? ranked[0][0] : "inform";
  const confidence = ranked.length > 0 ? Math.min(1, ranked[0][1] + 0.3) : 0.5;

  const labels: Record<PageIntentType, { en: string; nb: string }> = {
    inform: { en: "Inform", nb: "Informere" },
    sell: { en: "Sell", nb: "Selge" },
    recruit: { en: "Recruit", nb: "Rekruttere" },
    trust: { en: "Build trust", nb: "Bygge tillit" },
  };

  const label = isEn ? labels[primaryIntent].en : labels[primaryIntent].nb;

  const summary = isEn
    ? `Page intent: ${labels[primaryIntent].en} (${(confidence * 100).toFixed(0)}% confidence). Use for structure, sections, and CTA suggestions.`
    : `Sideintensjon: ${labels[primaryIntent].nb} (${(confidence * 100).toFixed(0)}% konfidens). Brukes for struktur-, seksjons- og CTA-forslag.`;

  return {
    primaryIntent,
    confidence: Math.round(confidence * 100) / 100,
    label,
    summary,
    detectedAt: new Date().toISOString(),
  };
}

export { detectPageIntentCapability, CAPABILITY_NAME };
