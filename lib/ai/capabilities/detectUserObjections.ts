/**
 * AI objection detection capability: detectUserObjections.
 * Checks page/site content against common user objection types (price, trust, complexity, time, risk).
 * Reports which objections are likely addressed vs unaddressed and suggests copy or content to add.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectUserObjections";

const detectUserObjectionsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Detects user objections: compares content to common objection types (price, trust, complexity, time, risk). Reports addressed vs likely unaddressed objections and suggests content or copy to add.",
  requiredContext: ["content"],
  inputSchema: {
    type: "object",
    description: "Detect user objections input",
    properties: {
      content: {
        type: "object",
        description: "Content to check (plainText or blocks)",
        properties: {
          plainText: { type: "string" },
          blocks: {
            type: "array",
            description: "Blocks with heading, body",
            items: { type: "object" },
          },
        },
      },
      businessType: { type: "string", description: "Optional: e.g. saas, restaurant, e-commerce" },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["content"],
  },
  outputSchema: {
    type: "object",
    description: "Detected objections and status",
    required: ["objections", "summary"],
    properties: {
      objections: {
        type: "array",
        items: {
          type: "object",
          required: ["type", "status", "message", "suggestion", "priority"],
          properties: {
            type: { type: "string", description: "price | trust | complexity | time | risk | support" },
            status: { type: "string", description: "addressed | likely_unaddressed" },
            message: { type: "string", description: "User objection or concern" },
            suggestion: { type: "string", description: "How to address in content" },
            priority: { type: "string", description: "low | medium | high" },
          },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "detection_only", description: "Output is detection and suggestions only; no content mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(detectUserObjectionsCapability);

export type ObjectionContentInput = {
  plainText?: string | null;
  blocks?: Array<{ heading?: string | null; body?: string | null }> | null;
};

export type DetectUserObjectionsInput = {
  content: ObjectionContentInput;
  businessType?: string | null;
  locale?: "nb" | "en" | null;
};

export type DetectedObjection = {
  type: "price" | "trust" | "complexity" | "time" | "risk" | "support";
  status: "addressed" | "likely_unaddressed";
  message: string;
  suggestion: string;
  priority: "low" | "medium" | "high";
};

export type DetectUserObjectionsOutput = {
  objections: DetectedObjection[];
  summary: string;
};

type ObjectionDef = {
  type: DetectedObjection["type"];
  keywordsEn: string[];
  keywordsNb: string[];
  messageEn: string;
  messageNb: string;
  suggestionEn: string;
  suggestionNb: string;
  priority: DetectedObjection["priority"];
};

const OBJECTION_DEFS: ObjectionDef[] = [
  {
    type: "price",
    keywordsEn: ["price", "pricing", "cost", "affordable", "value", "free trial", "discount", "plan", "pay"],
    keywordsNb: ["pris", "priser", "kostnad", "rimelig", "verdi", "prøveperiode", "rabatt", "plan", "betale"],
    messageEn: "Is it worth the cost?",
    messageNb: "Er det verdt prisen?",
    suggestionEn: "Add clear pricing, value comparison, or guarantee; mention ROI or savings.",
    suggestionNb: "Legg til tydelig prising, verdissammenligning eller garanti; nevne ROI eller besparelse.",
    priority: "high",
  },
  {
    type: "trust",
    keywordsEn: ["trust", "review", "testimonial", "customer", "secure", "certified", "guarantee", "safe", "privacy"],
    keywordsNb: ["tillit", "anmeldelse", "tilbakemelding", "kunde", "sikker", "sertifisert", "garanti", "personvern"],
    messageEn: "Can I trust this?",
    messageNb: "Kan jeg stole på dette?",
    suggestionEn: "Add testimonials, reviews, certifications, or guarantee and privacy policy link.",
    suggestionNb: "Legg til tilbakemeldinger, anmeldelser, sertifiseringer eller garanti og lenke til personvern.",
    priority: "high",
  },
  {
    type: "complexity",
    keywordsEn: ["simple", "easy", "quick", "how it works", "step", "guide", "setup", "start"],
    keywordsNb: ["enkelt", "lett", "rask", "slik fungerer", "steg", "veiledning", "oppsett", "kom i gang"],
    messageEn: "Is it too complicated?",
    messageNb: "Er det for komplisert?",
    suggestionEn: "Add a short how-it-works, steps, or 'get started in 3 steps' section.",
    suggestionNb: "Legg til kort «slik fungerer det», steg eller «kom i gang på 3 steg».",
    priority: "medium",
  },
  {
    type: "time",
    keywordsEn: ["fast", "quick", "minutes", "today", "delivery", "time", "deadline", "schedule"],
    keywordsNb: ["rask", "hurtig", "minutter", "i dag", "levering", "tid", "frist", "planlegge"],
    messageEn: "Will it take too long?",
    messageNb: "Tar det for lang tid?",
    suggestionEn: "Mention delivery time, setup time, or 'ready in X minutes'.",
    suggestionNb: "Nevn leveringstid, oppsettstid eller «klar på X minutter».",
    priority: "medium",
  },
  {
    type: "risk",
    keywordsEn: ["guarantee", "refund", "cancel", "risk-free", "money-back", "trial", "commitment"],
    keywordsNb: ["garanti", "refusjon", "avbestille", "risikofri", "pengene tilbake", "prøve", "forpliktelse"],
    messageEn: "What if it doesn't work for me?",
    messageNb: "Hva om det ikke passer for meg?",
    suggestionEn: "Add guarantee, refund policy, free trial, or easy cancel.",
    suggestionNb: "Legg til garanti, refusjonsregler, prøveperiode eller enkel avbestilling.",
    priority: "high",
  },
  {
    type: "support",
    keywordsEn: ["support", "help", "contact", "faq", "question", "chat", "phone", "email"],
    keywordsNb: ["support", "hjelp", "kontakt", "faq", "spørsmål", "chat", "telefon", "epost"],
    messageEn: "Who do I ask if I have questions?",
    messageNb: "Hvem spør jeg om jeg lurer på noe?",
    suggestionEn: "Add visible contact, FAQ, or support section.",
    suggestionNb: "Legg til synlig kontakt, FAQ eller støtteseksjon.",
    priority: "medium",
  },
];

function extractText(content: ObjectionContentInput): string {
  const plain = (content.plainText ?? "").trim();
  if (plain) return plain.toLowerCase();
  const blocks = Array.isArray(content.blocks) ? content.blocks : [];
  const parts: string[] = [];
  for (const b of blocks) {
    const h = (b?.heading ?? "").trim();
    const body = (b?.body ?? "").trim();
    if (h) parts.push(h);
    if (body) parts.push(body);
  }
  return parts.join(" ").toLowerCase();
}

function contentAddressesObjection(text: string, def: ObjectionDef, isEn: boolean): boolean {
  const keywords = isEn ? def.keywordsEn : def.keywordsNb;
  for (const k of keywords) {
    if (text.includes(k.toLowerCase())) return true;
  }
  return false;
}

/**
 * Detects user objections: checks content for common objection types and reports addressed vs likely unaddressed.
 * Deterministic; no external calls.
 */
export function detectUserObjections(input: DetectUserObjectionsInput): DetectUserObjectionsOutput {
  const isEn = input.locale === "en";
  const content = input.content ?? {};
  const text = extractText(content);

  const objections: DetectedObjection[] = [];

  for (const def of OBJECTION_DEFS) {
    const addressed = contentAddressesObjection(text, def, isEn);
    objections.push({
      type: def.type,
      status: addressed ? "addressed" : "likely_unaddressed",
      message: isEn ? def.messageEn : def.messageNb,
      suggestion: addressed ? (isEn ? "Content appears to address this." : "Innholdet ser ut til å adressere dette.") : (isEn ? def.suggestionEn : def.suggestionNb),
      priority: def.priority,
    });
  }

  const unaddressed = objections.filter((o) => o.status === "likely_unaddressed");
  const summary = isEn
    ? `${unaddressed.length} of ${objections.length} objection types likely unaddressed. ${unaddressed.length === 0 ? "All common objections appear covered." : "Consider adding content for: " + unaddressed.map((o) => o.type).join(", ") + "."}`
    : `${unaddressed.length} av ${objections.length} objektionstyper sannsynligvis ikke adressert. ${unaddressed.length === 0 ? "Alle vanlige innvendinger ser ut til å være dekket." : "Vurder å legge til innhold for: " + unaddressed.map((o) => o.type).join(", ") + "."}`;

  return {
    objections,
    summary,
  };
}

export { detectUserObjectionsCapability, CAPABILITY_NAME };
